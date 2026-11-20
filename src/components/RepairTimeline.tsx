import React from 'react';
import { Check, Clock, XCircle } from 'lucide-react';
import { RepairStatus } from '../types/repairloop';

interface RepairTimelineProps {
  status: RepairStatus;
}

const TIMELINE_STEPS: { key: RepairStatus; label: string }[] = [
  { key: 'PENDING', label: 'Request Submitted' },
  { key: 'QUOTATION_RECEIVED', label: 'Quotations Received' },
  { key: 'QUOTATION_ACCEPTED', label: 'Provider Selected' },
  { key: 'REPAIR_IN_PROGRESS', label: 'Repair In Progress' },
  { key: 'REPAIR_COMPLETED', label: 'Repair Completed' },
];

export const RepairTimeline: React.FC<RepairTimelineProps> = ({ status }) => {
  if (status === 'CANCELLED') {
    return (
      <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-lg px-3.5 py-2.5">
        <XCircle className="w-4 h-4 text-slate-500 shrink-0" />
        <span>This repair request was cancelled prior to provider selection.</span>
      </div>
    );
  }

  const currentIndex = TIMELINE_STEPS.findIndex((step) => step.key === status);

  return (
    <div className="w-full overflow-x-auto pb-1">
      <div className="min-w-[540px] grid grid-cols-5 gap-2">
        {TIMELINE_STEPS.map((step, index) => {
          const isCompleted =
            index < currentIndex || status === 'REPAIR_COMPLETED';
          const isCurrent = index === currentIndex && status !== 'REPAIR_COMPLETED';

          return (
            <div key={step.key} className="flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 border ${
                    isCompleted
                      ? 'bg-teal-600 border-teal-600 text-white'
                      : isCurrent
                      ? 'bg-navy-900 border-navy-900 text-white'
                      : 'bg-white border-slate-300 text-slate-400'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : isCurrent ? (
                    <Clock className="w-3.5 h-3.5" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                {index < TIMELINE_STEPS.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 ${
                      index < currentIndex ? 'bg-teal-600' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
              <span
                className={`text-xs leading-snug ${
                  isCompleted
                    ? 'font-semibold text-teal-800'
                    : isCurrent
                    ? 'font-semibold text-navy-950'
                    : 'text-slate-500'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
