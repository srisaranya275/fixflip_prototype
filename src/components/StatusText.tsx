import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Wrench,
  XCircle,
} from 'lucide-react';

interface StatusTextProps {
  status: string;
}

const STATUS_MAP: Record<
  string,
  { label: string; colorClass: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  PENDING: { label: 'Pending Review', colorClass: 'text-amber-700', Icon: Clock },
  QUOTATION_RECEIVED: {
    label: 'Quotations Received',
    colorClass: 'text-teal-700',
    Icon: Clock,
  },
  QUOTATION_ACCEPTED: {
    label: 'Provider Selected',
    colorClass: 'text-navy-800',
    Icon: CheckCircle2,
  },
  REPAIR_IN_PROGRESS: {
    label: 'Repair In Progress',
    colorClass: 'text-teal-700',
    Icon: Wrench,
  },
  REPAIR_COMPLETED: {
    label: 'Repair Completed',
    colorClass: 'text-emerald-700',
    Icon: CheckCircle2,
  },
  CANCELLED: { label: 'Cancelled', colorClass: 'text-slate-500', Icon: XCircle },
  ACCEPTED: { label: 'Accepted', colorClass: 'text-emerald-700', Icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', colorClass: 'text-red-700', Icon: XCircle },
  AVAILABLE: { label: 'Available', colorClass: 'text-teal-700', Icon: CheckCircle2 },
  OFFER_RECEIVED: {
    label: 'Offers Received',
    colorClass: 'text-amber-700',
    Icon: Clock,
  },
  SOLD: { label: 'Sold', colorClass: 'text-navy-900', Icon: CheckCircle2 },
  ACTIVE: { label: 'Active', colorClass: 'text-emerald-700', Icon: CheckCircle2 },
  'EXPIRING SOON': {
    label: 'Expiring Soon',
    colorClass: 'text-amber-700',
    Icon: AlertTriangle,
  },
  EXPIRED: { label: 'Expired', colorClass: 'text-red-700', Icon: ShieldAlert },
};

export const StatusText: React.FC<StatusTextProps> = ({ status }) => {
  const entry = STATUS_MAP[status] || {
    label: status.replace(/_/g, ' '),
    colorClass: 'text-slate-700',
    Icon: Clock,
  };
  const Icon = entry.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${entry.colorClass}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{entry.label}</span>
    </span>
  );
};
