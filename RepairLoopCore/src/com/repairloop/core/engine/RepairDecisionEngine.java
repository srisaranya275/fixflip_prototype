package com.repairloop.core.engine;

import com.repairloop.core.enums.DecisionRecommendation;
import com.repairloop.core.model.DecisionResult;
import com.repairloop.core.model.ProductInfo;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Core weighted Repair-vs-Replace scoring engine for RepairLoop.
 *
 * Weights (total 100 points toward Repair viability):
 *   1. Cost Ratio (repairCost / replacementPrice) ............ 35 pts max
 *   2. Product Age Factor .................................... 20 pts max
 *   3. Estimated Additional Lifespan After Repair ............ 20 pts max
 *   4. Previous Repair History (count + cumulative cost) ..... 15 pts max
 *   5. Recurring Fault Stability ............................. 10 pts max
 *
 * All outputs are advisory estimates and not guaranteed outcomes.
 */
public class RepairDecisionEngine {

    private static final double REPAIR_THRESHOLD = 52.0;

    public DecisionResult evaluate(
            ProductInfo product,
            double estimatedRepairCost,
            int estimatedAdditionalLifespanMonths) {

        if (product == null) {
            throw new IllegalArgumentException("ProductInfo must not be null.");
        }
        if (estimatedRepairCost < 0) {
            throw new IllegalArgumentException("Repair cost cannot be negative.");
        }

        double replacementCost = Math.max(1.0, product.getReplacementPrice());
        double originalPrice = Math.max(1.0, product.getOriginalPrice());

        // 1. Cost Ratio Score (35 pts max): lower repair-to-replacement ratio is better
        double costRatio = estimatedRepairCost / replacementCost;
        double costRatioPercent = Math.round(costRatio * 1000.0) / 10.0;
        double costScore;
        if (costRatio <= 0.15) {
            costScore = 35.0;
        } else if (costRatio >= 0.75) {
            costScore = 0.0;
        } else {
            costScore = 35.0 * (1.0 - (costRatio - 0.15) / 0.60);
        }

        // 2. Product Age Score (20 pts max): younger devices retain more useful life
        double ageYears = product.getProductAgeYears();
        double ageScore;
        if (ageYears <= 1.0) {
            ageScore = 20.0;
        } else if (ageYears >= 10.0) {
            ageScore = 2.0;
        } else {
            ageScore = 20.0 - ((ageYears - 1.0) / 9.0) * 18.0;
        }

        // 3. Additional Lifespan Score (20 pts max): 36+ months scores full points
        int extraMonths = Math.max(0, estimatedAdditionalLifespanMonths);
        double lifespanScore = Math.min(20.0, (extraMonths / 36.0) * 20.0);

        // 4. Repair History Score (15 pts max): penalize frequent repairs and high cumulative spend
        int prevCount = product.getPreviousRepairCount();
        double prevCostRatio = product.getPreviousRepairCost() / originalPrice;
        double countPenalty = Math.min(9.0, prevCount * 2.5);
        double spendPenalty = Math.min(6.0, prevCostRatio * 12.0);
        double historyScore = Math.max(0.0, 15.0 - countPenalty - spendPenalty);

        // 5. Recurring Fault Score (10 pts max)
        double recurringScore = product.isRecurringFault() ? 2.0 : 10.0;

        double rawRepairScore = costScore + ageScore + lifespanScore + historyScore + recurringScore;
        double repairScore = Math.round(Math.max(0.0, Math.min(100.0, rawRepairScore)) * 10.0) / 10.0;
        double replacementScore = Math.round((100.0 - repairScore) * 10.0) / 10.0;
        double estimatedSavings = Math.round((replacementCost - estimatedRepairCost) * 100.0) / 100.0;

        DecisionRecommendation recommendation = (repairScore >= REPAIR_THRESHOLD && costRatio <= 0.70)
                ? DecisionRecommendation.REPAIR
                : DecisionRecommendation.REPLACE;

        Map<String, Double> breakdown = new LinkedHashMap<>();
        breakdown.put("costRatioPoints", roundOne(costScore));
        breakdown.put("productAgePoints", roundOne(ageScore));
        breakdown.put("lifespanGainPoints", roundOne(lifespanScore));
        breakdown.put("repairHistoryPoints", roundOne(historyScore));
        breakdown.put("faultStabilityPoints", roundOne(recurringScore));

        String explanation = buildExplanation(
                recommendation, costRatioPercent, ageYears, extraMonths,
                prevCount, product.isRecurringFault(), estimatedSavings);

        return new DecisionResult(
                repairScore,
                replacementScore,
                costRatioPercent,
                estimatedSavings,
                extraMonths,
                recommendation,
                explanation,
                breakdown
        );
    }

    private String buildExplanation(
            DecisionRecommendation recommendation,
            double costRatioPercent,
            double ageYears,
            int extraMonths,
            int prevCount,
            boolean recurringFault,
            double estimatedSavings) {
        StringBuilder sb = new StringBuilder();
        if (recommendation == DecisionRecommendation.REPAIR) {
            sb.append(String.format(
                "Repairing is recommended as an estimate: repair cost is %.1f%% of replacement cost with projected savings of $%.2f and ~%d additional months of service.",
                costRatioPercent, estimatedSavings, extraMonths));
        } else {
            sb.append(String.format(
                "Replacing is recommended as an estimate: repair cost reaches %.1f%% of replacement price",
                costRatioPercent));
            if (recurringFault || prevCount >= 2) {
                sb.append(String.format(" alongside %d prior repair(s)%s",
                        prevCount, recurringFault ? " and a recurring fault pattern" : ""));
            }
            if (ageYears >= 6.0) {
                sb.append(String.format(" on a %.1f-year-old unit", ageYears));
            }
            sb.append(".");
        }
        sb.append(" Advisory estimate only — actual longevity and costs may vary.");
        return sb.toString();
    }

    private double roundOne(double value) {
        return Math.round(value * 10.0) / 10.0;
    }
}
