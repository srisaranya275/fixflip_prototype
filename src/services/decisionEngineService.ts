import {
  DecisionFactorBreakdown,
  DecisionInput,
  DecisionRecommendation,
  DecisionResult,
} from '../types/repairloop';

const REPAIR_THRESHOLD = 52.0;

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * TypeScript mirror of com.repairloop.core.engine.RepairDecisionEngine.
 * Uses the exact same weighted 100-point rubric as RepairLoopCore.
 */
export function evaluateRepairVsReplaceLocal(input: DecisionInput): DecisionResult {
  const replacementCost = Math.max(1, input.replacementCost);
  const originalPrice = Math.max(1, input.originalPrice);
  const repairCost = Math.max(0, input.repairCost);
  const ageYears = Math.max(0, input.productAgeYears);
  const extraMonths = Math.max(0, Math.round(input.additionalLifespanMonths));
  const prevCount = Math.max(0, Math.round(input.previousRepairCount));
  const prevCost = Math.max(0, input.previousRepairCost);

  // 1. Cost Ratio Score (35 pts max)
  const costRatio = repairCost / replacementCost;
  const costRatioPercent = roundOne(costRatio * 100);
  let costScore: number;
  if (costRatio <= 0.15) {
    costScore = 35;
  } else if (costRatio >= 0.75) {
    costScore = 0;
  } else {
    costScore = 35 * (1 - (costRatio - 0.15) / 0.6);
  }

  // 2. Product Age Score (20 pts max)
  let ageScore: number;
  if (ageYears <= 1) {
    ageScore = 20;
  } else if (ageYears >= 10) {
    ageScore = 2;
  } else {
    ageScore = 20 - ((ageYears - 1) / 9) * 18;
  }

  // 3. Additional Lifespan Score (20 pts max)
  const lifespanScore = Math.min(20, (extraMonths / 36) * 20);

  // 4. Previous Repair History Score (15 pts max)
  const prevCostRatio = prevCost / originalPrice;
  const countPenalty = Math.min(9, prevCount * 2.5);
  const spendPenalty = Math.min(6, prevCostRatio * 12);
  const historyScore = Math.max(0, 15 - countPenalty - spendPenalty);

  // 5. Recurring Fault Stability Score (10 pts max)
  const recurringScore = input.recurringFault ? 2 : 10;

  const rawRepairScore =
    costScore + ageScore + lifespanScore + historyScore + recurringScore;
  const repairScore = roundOne(Math.max(0, Math.min(100, rawRepairScore)));
  const replacementScore = roundOne(100 - repairScore);
  const estimatedSavings = Math.round((replacementCost - repairCost) * 100) / 100;

  const recommendation: DecisionRecommendation =
    repairScore >= REPAIR_THRESHOLD && costRatio <= 0.7 ? 'REPAIR' : 'REPLACE';

  const factorBreakdown: DecisionFactorBreakdown = {
    costRatioPoints: roundOne(costScore),
    productAgePoints: roundOne(ageScore),
    lifespanGainPoints: roundOne(lifespanScore),
    repairHistoryPoints: roundOne(historyScore),
    faultStabilityPoints: roundOne(recurringScore),
  };

  let explanation = '';
  if (recommendation === 'REPAIR') {
    explanation = `Repairing is recommended as an estimate: repair cost is ${costRatioPercent.toFixed(1)}% of replacement cost with projected savings of $${estimatedSavings.toFixed(2)} and ~${extraMonths} additional months of service.`;
  } else {
    explanation = `Replacing is recommended as an estimate: repair cost reaches ${costRatioPercent.toFixed(1)}% of replacement price`;
    if (input.recurringFault || prevCount >= 2) {
      explanation += ` alongside ${prevCount} prior repair(s)${
        input.recurringFault ? ' and a recurring fault pattern' : ''
      }`;
    }
    if (ageYears >= 6) {
      explanation += ` on a ${ageYears.toFixed(1)}-year-old unit`;
    }
    explanation += '.';
  }
  explanation += ' Advisory estimate only — actual longevity and costs may vary.';

  return {
    repairScore,
    replacementScore,
    repairCostRatioPercent: costRatioPercent,
    estimatedSavings,
    additionalLifespanMonths: extraMonths,
    recommendation,
    explanation,
    factorBreakdown,
    engineSource: 'typescript-mirror',
  };
}

/**
 * Integration-ready client that optionally calls RepairLoopCore's Java 21
 * built-in HttpServer (RepairLoopHttpServer) when a valid endpoint is reachable,
 * or transparently executes the local TypeScript mirror without false claims.
 */
export async function evaluateWithJavaBridgeOrLocal(
  input: DecisionInput,
  javaServerUrl?: string
): Promise<DecisionResult> {
  const localResult = evaluateRepairVsReplaceLocal(input);
  const trimmedUrl = javaServerUrl?.trim().replace(/\/$/, '');
  if (!trimmedUrl) {
    return localResult;
  }

  try {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 1800);
    const response = await fetch(`${trimmedUrl}/api/decision/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    window.clearTimeout(timeoutId);

    if (!response.ok) {
      return localResult;
    }

    const data = await response.json();
    return {
      repairScore: Number(data.repairScore ?? localResult.repairScore),
      replacementScore: Number(data.replacementScore ?? localResult.replacementScore),
      repairCostRatioPercent: Number(
        data.repairCostRatioPercent ?? localResult.repairCostRatioPercent
      ),
      estimatedSavings: Number(data.estimatedSavings ?? localResult.estimatedSavings),
      additionalLifespanMonths: Number(
        data.additionalLifespanMonths ?? localResult.additionalLifespanMonths
      ),
      recommendation:
        data.recommendation === 'REPAIR' || data.recommendation === 'REPLACE'
          ? data.recommendation
          : localResult.recommendation,
      explanation: String(data.explanation ?? localResult.explanation),
      factorBreakdown: localResult.factorBreakdown,
      engineSource: 'java-http-core',
    };
  } catch {
    return localResult;
  }
}

export async function checkJavaCoreHealth(javaServerUrl: string): Promise<boolean> {
  const trimmedUrl = javaServerUrl.trim().replace(/\/$/, '');
  if (!trimmedUrl) return false;
  try {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 1500);
    const response = await fetch(`${trimmedUrl}/api/health`, {
      signal: controller.signal,
    });
    window.clearTimeout(timeoutId);
    if (!response.ok) return false;
    const payload = await response.json();
    return payload?.status === 'ok';
  } catch {
    return false;
  }
}
