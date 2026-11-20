import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  BookmarkCheck,
  Calculator,
  CheckCircle2,
  RefreshCw,
  Server,
} from 'lucide-react';
import {
  checkJavaCoreHealth,
  evaluateRepairVsReplaceLocal,
  evaluateWithJavaBridgeOrLocal,
} from '../services/decisionEngineService';
import {
  formatTimestamp,
  saveDecisionAnalysis,
  subscribeDecisionHistory,
} from '../services/firestoreService';
import {
  DecisionHistoryRecord,
  DecisionInput,
  DecisionResult,
} from '../types/repairloop';

interface DecisionEngineViewProps {
  userId: string;
  initialInput?: Partial<DecisionInput>;
}

const DEFAULT_INPUT: DecisionInput = {
  productName: 'ZenBook 14 OLED Laptop',
  originalPrice: 1200,
  productAgeYears: 2.5,
  repairCost: 215,
  replacementCost: 1150,
  additionalLifespanMonths: 30,
  previousRepairCount: 0,
  previousRepairCost: 0,
  recurringFault: false,
};

export const DecisionEngineView: React.FC<DecisionEngineViewProps> = ({
  userId,
  initialInput,
}) => {
  const [input, setInput] = useState<DecisionInput>({
    ...DEFAULT_INPUT,
    ...initialInput,
  });
  const [result, setResult] = useState<DecisionResult>(() =>
    evaluateRepairVsReplaceLocal({ ...DEFAULT_INPUT, ...initialInput })
  );
  const [javaBridgeUrl, setJavaBridgeUrl] = useState('');
  const [javaConnected, setJavaConnected] = useState(false);
  const [checkingBridge, setCheckingBridge] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [history, setHistory] = useState<DecisionHistoryRecord[]>([]);

  useEffect(() => {
    if (initialInput) {
      const merged = { ...DEFAULT_INPUT, ...initialInput };
      setInput(merged);
      setResult(evaluateRepairVsReplaceLocal(merged));
    }
  }, [initialInput]);

  useEffect(() => {
    const unsub = subscribeDecisionHistory(userId, setHistory);
    return () => unsub();
  }, [userId]);

  const handleFieldChange = <K extends keyof DecisionInput>(
    key: K,
    value: DecisionInput[K]
  ) => {
    const updated = { ...input, [key]: value };
    setInput(updated);
    setSaveFeedback(null);
    if (!javaConnected) {
      setResult(evaluateRepairVsReplaceLocal(updated));
    }
  };

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveFeedback(null);
    const evaluated = await evaluateWithJavaBridgeOrLocal(
      input,
      javaConnected ? javaBridgeUrl : undefined
    );
    setResult(evaluated);
  };

  const handleTestJavaBridge = async () => {
    const target = javaBridgeUrl.trim() || 'http://localhost:8080';
    setJavaBridgeUrl(target);
    setCheckingBridge(true);
    const ok = await checkJavaCoreHealth(target);
    setJavaConnected(ok);
    if (ok) {
      const evaluated = await evaluateWithJavaBridgeOrLocal(input, target);
      setResult(evaluated);
    } else {
      setResult(evaluateRepairVsReplaceLocal(input));
    }
    setCheckingBridge(false);
  };

  const handleSaveAnalysis = async () => {
    setSaving(true);
    setSaveFeedback(null);
    try {
      await saveDecisionAnalysis(userId, input, result);
      setSaveFeedback('Analysis saved to your history.');
    } catch {
      setSaveFeedback('Unable to save analysis. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const factorRows = [
    {
      label: 'Repair vs. Replacement Cost Ratio',
      points: result.factorBreakdown.costRatioPoints,
      max: 35,
    },
    {
      label: 'Product Age Viability',
      points: result.factorBreakdown.productAgePoints,
      max: 20,
    },
    {
      label: 'Expected Additional Lifespan Gain',
      points: result.factorBreakdown.lifespanGainPoints,
      max: 20,
    },
    {
      label: 'Prior Repair History & Spend',
      points: result.factorBreakdown.repairHistoryPoints,
      max: 15,
    },
    {
      label: 'Fault Stability (Non-Recurring)',
      points: result.factorBreakdown.faultStabilityPoints,
      max: 10,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-950 tracking-tight">
            Repair-vs-Replace Decision Engine
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Transparent 100-point weighted evaluation aligned with RepairLoopCore&apos;s{' '}
            <code className="font-mono text-xs text-navy-800">RepairDecisionEngine.java</code>.
          </p>
        </div>

        <div className="text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-3.5 py-2 flex items-center gap-2">
          <Server className="w-4 h-4 text-teal-600 shrink-0" />
          <span>
            Active Engine:{' '}
            <strong className="text-navy-950">
              {result.engineSource === 'java-http-core'
                ? 'Java 21 RepairLoopCore HTTP Service'
                : 'Frontend TypeScript Mirror (Standalone)'}
            </strong>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Inputs Form */}
        <form
          onSubmit={handleEvaluate}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-semibold text-navy-950 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-teal-600" />
              <span>Product &amp; Cost Parameters</span>
            </h2>
            <button
              type="button"
              onClick={() => {
                setInput(DEFAULT_INPUT);
                setResult(evaluateRepairVsReplaceLocal(DEFAULT_INPUT));
              }}
              className="text-xs font-medium text-teal-700 hover:text-teal-800 cursor-pointer"
            >
              Reset Example
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Product Name
            </label>
            <input
              type="text"
              required
              value={input.productName}
              onChange={(e) => handleFieldChange('productName', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Original Price ($)
              </label>
              <input
                type="number"
                min={1}
                step="0.01"
                required
                value={input.originalPrice}
                onChange={(e) =>
                  handleFieldChange('originalPrice', Number(e.target.value))
                }
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Product Age (Years)
              </label>
              <input
                type="number"
                min={0}
                max={40}
                step="0.5"
                required
                value={input.productAgeYears}
                onChange={(e) =>
                  handleFieldChange('productAgeYears', Number(e.target.value))
                }
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Estimated Repair Cost ($)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={input.repairCost}
                onChange={(e) =>
                  handleFieldChange('repairCost', Number(e.target.value))
                }
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Replacement Cost ($)
              </label>
              <input
                type="number"
                min={1}
                step="0.01"
                required
                value={input.replacementCost}
                onChange={(e) =>
                  handleFieldChange('replacementCost', Number(e.target.value))
                }
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Extra Lifespan (Months)
              </label>
              <input
                type="number"
                min={1}
                max={180}
                required
                value={input.additionalLifespanMonths}
                onChange={(e) =>
                  handleFieldChange(
                    'additionalLifespanMonths',
                    Number(e.target.value)
                  )
                }
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Previous Repairs (#)
              </label>
              <input
                type="number"
                min={0}
                max={50}
                required
                value={input.previousRepairCount}
                onChange={(e) =>
                  handleFieldChange(
                    'previousRepairCount',
                    Number(e.target.value)
                  )
                }
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Cumulative Previous Repair Spend ($)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              required
              value={input.previousRepairCost}
              onChange={(e) =>
                handleFieldChange('previousRepairCost', Number(e.target.value))
              }
              className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={input.recurringFault}
              onChange={(e) =>
                handleFieldChange('recurringFault', e.target.checked)
              }
              className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600"
            />
            <span className="text-sm text-slate-700">
              Recurring fault (same failure occurred previously)
            </span>
          </label>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 text-sm font-semibold text-white bg-navy-900 hover:bg-navy-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              Recalculate Recommendation
            </button>
            <button
              type="button"
              onClick={handleSaveAnalysis}
              disabled={saving}
              className="py-2.5 px-4 text-sm font-semibold text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-60"
            >
              <BookmarkCheck className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Result'}</span>
            </button>
          </div>

          {saveFeedback && (
            <p className="text-xs font-medium text-teal-700">{saveFeedback}</p>
          )}
        </form>

        {/* Right Output Visualization */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100">
              <div>
                <div className="text-xs font-medium text-slate-500">
                  Advisory Recommendation
                </div>
                <div className="flex items-center gap-2.5 mt-1">
                  {result.recommendation === 'REPAIR' ? (
                    <CheckCircle2 className="w-6 h-6 text-teal-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
                  )}
                  <span className="text-2xl font-bold text-navy-950 tracking-tight">
                    {result.recommendation}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-xs text-slate-500">Repair Score</div>
                  <div className="text-xl font-bold font-mono tabular-nums text-teal-700">
                    {result.repairScore.toFixed(1)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Replace Score</div>
                  <div className="text-xl font-bold font-mono tabular-nums text-navy-900">
                    {result.replacementScore.toFixed(1)}
                  </div>
                </div>
              </div>
            </div>

            {/* Visual SVG Comparison Bar */}
            <div className="py-5 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                <span>Repair Viability ({result.repairScore.toFixed(1)}%)</span>
                <span>Replacement Viability ({result.replacementScore.toFixed(1)}%)</span>
              </div>
              <svg
                viewBox="0 0 400 18"
                className="w-full h-4 rounded-md overflow-hidden bg-slate-100"
                role="img"
                aria-label={`Repair score ${result.repairScore} versus replacement score ${result.replacementScore}`}
              >
                <rect
                  x="0"
                  y="0"
                  width={Math.max(4, (result.repairScore / 100) * 400)}
                  height="18"
                  fill="#0d9488"
                />
                <rect
                  x={Math.max(4, (result.repairScore / 100) * 400)}
                  y="0"
                  width={Math.max(0, 400 - (result.repairScore / 100) * 400)}
                  height="18"
                  fill="#0f1f3d"
                />
              </svg>
            </div>

            {/* Key Metrics Strip */}
            <div className="grid grid-cols-3 gap-4 py-4 border-y border-slate-100">
              <div>
                <div className="text-xs text-slate-500">Repair Cost %</div>
                <div className="text-lg font-bold font-mono tabular-nums text-navy-950 mt-0.5">
                  {result.repairCostRatioPercent.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Estimated Savings</div>
                <div className="text-lg font-bold font-mono tabular-nums text-teal-700 mt-0.5">
                  ${result.estimatedSavings.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Additional Lifespan</div>
                <div className="text-lg font-bold font-mono tabular-nums text-navy-950 mt-0.5">
                  {result.additionalLifespanMonths} mo
                </div>
              </div>
            </div>

            {/* Explanation */}
            <div className="pt-4 space-y-3">
              <p className="text-sm text-slate-700 leading-relaxed">
                {result.explanation}
              </p>

              {/* Transparent Weighted Breakdown */}
              <div className="pt-2 space-y-2.5">
                <div className="text-xs font-semibold text-slate-700">
                  Weighted Scoring Breakdown (Max 100 pts)
                </div>
                {factorRows.map((row) => (
                  <div key={row.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">{row.label}</span>
                      <span className="font-mono tabular-nums font-medium text-navy-950">
                        {row.points.toFixed(1)} / {row.max}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-600 rounded-full"
                        style={{ width: `${Math.min(100, (row.points / row.max) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Optional Java Core HTTP Bridge */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-navy-950">
                  Optional Java Core REST Bridge (RepairLoopHttpServer)
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Run <code className="font-mono">java -cp out com.repairloop.core.server.RepairLoopHttpServer 8080</code> locally to connect directly to the Java 21 engine.
                </p>
              </div>
              <span
                className={`text-xs font-semibold whitespace-nowrap ${
                  javaConnected ? 'text-emerald-700' : 'text-slate-500'
                }`}
              >
                {javaConnected ? 'Connected to Java Core' : 'Standalone Mode'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="url"
                value={javaBridgeUrl}
                onChange={(e) => setJavaBridgeUrl(e.target.value)}
                placeholder="http://localhost:8080"
                className="flex-1 px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
              <button
                type="button"
                onClick={handleTestJavaBridge}
                disabled={checkingBridge}
                className="px-4 py-2 text-xs font-semibold text-navy-950 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${checkingBridge ? 'animate-spin' : ''}`}
                />
                <span>{checkingBridge ? 'Checking...' : 'Connect Java Service'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Saved History Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-navy-950">
            Saved Evaluation History
          </h3>
        </div>
        {history.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No saved evaluations yet. Click &ldquo;Save Result&rdquo; above to persist an
            analysis in Firestore.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4 text-right">Repair</th>
                  <th className="py-3 px-4 text-right">Replace</th>
                  <th className="py-3 px-4 text-right">Repair Score</th>
                  <th className="py-3 px-4">Outcome</th>
                  <th className="py-3 px-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-medium text-navy-950">
                      {item.productName}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                      ${item.repairCost.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                      ${item.replacementCost.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-teal-700">
                      {item.repairScore.toFixed(1)}
                    </td>
                    <td className="py-3 px-4 font-semibold text-navy-950">
                      {item.recommendation}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                      {formatTimestamp(item.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
