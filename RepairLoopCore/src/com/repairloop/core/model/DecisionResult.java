package com.repairloop.core.model;

import com.repairloop.core.enums.DecisionRecommendation;
import java.util.Collections;
import java.util.Map;

/**
 * Structured output returned by RepairDecisionEngine.
 * Includes transparent factor breakdown and advisory disclaimer.
 */
public class DecisionResult {
    private final double repairScore;
    private final double replacementScore;
    private final double repairCostRatioPercent;
    private final double estimatedSavings;
    private final int additionalLifespanMonths;
    private final DecisionRecommendation recommendation;
    private final String explanation;
    private final Map<String, Double> factorBreakdown;

    public DecisionResult(
            double repairScore,
            double replacementScore,
            double repairCostRatioPercent,
            double estimatedSavings,
            int additionalLifespanMonths,
            DecisionRecommendation recommendation,
            String explanation,
            Map<String, Double> factorBreakdown) {
        this.repairScore = repairScore;
        this.replacementScore = replacementScore;
        this.repairCostRatioPercent = repairCostRatioPercent;
        this.estimatedSavings = estimatedSavings;
        this.additionalLifespanMonths = additionalLifespanMonths;
        this.recommendation = recommendation;
        this.explanation = explanation;
        this.factorBreakdown = Collections.unmodifiableMap(factorBreakdown);
    }

    public double getRepairScore() { return repairScore; }
    public double getReplacementScore() { return replacementScore; }
    public double getRepairCostRatioPercent() { return repairCostRatioPercent; }
    public double getEstimatedSavings() { return estimatedSavings; }
    public int getAdditionalLifespanMonths() { return additionalLifespanMonths; }
    public DecisionRecommendation getRecommendation() { return recommendation; }
    public String getExplanation() { return explanation; }
    public Map<String, Double> getFactorBreakdown() { return factorBreakdown; }

    public String toJson() {
        return String.format(
            "{\"repairScore\":%.1f,\"replacementScore\":%.1f,\"repairCostRatioPercent\":%.1f," +
            "\"estimatedSavings\":%.2f,\"additionalLifespanMonths\":%d,\"recommendation\":\"%s\"," +
            "\"explanation\":\"%s\"}",
            repairScore, replacementScore, repairCostRatioPercent,
            estimatedSavings, additionalLifespanMonths, recommendation.name(),
            explanation.replace("\"", "\\\"")
        );
    }

    @Override
    public String toString() {
        return String.format(
            "DecisionResult[recommendation=%s, repairScore=%.1f/100, replacementScore=%.1f/100, costRatio=%.1f%%, estimatedSavings=$%.2f, extraLifespan=%d mo]%nExplanation: %s",
            recommendation, repairScore, replacementScore, repairCostRatioPercent,
            estimatedSavings, additionalLifespanMonths, explanation
        );
    }
}
