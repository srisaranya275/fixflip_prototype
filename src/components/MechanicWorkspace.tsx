import React, { useEffect, useState } from 'react';
import {
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  LayoutDashboard,
  Search,
  Wrench,
} from 'lucide-react';
import {
  formatTimestamp,
  submitQuotation,
  subscribeMechanicAssignedRequests,
  subscribeMechanicQuotations,
  subscribeOpenRequestsForMechanics,
  subscribeUserNotifications,
  updateRepairProgressByMechanic,
} from '../services/firestoreService';
import {
  NotificationItem,
  PRODUCT_CATEGORIES,
  Quotation,
  RepairRequest,
  UserProfile,
} from '../types/repairloop';
import { ConfirmDialog } from './ConfirmDialog';
import { DashboardShell, NavItem } from './DashboardShell';
import { DecisionEngineView } from './DecisionEngineView';
import { RepairTimeline } from './RepairTimeline';
import { StatusText } from './StatusText';

interface MechanicWorkspaceProps {
  user: UserProfile;
  onSignOut: () => void;
}

export const MechanicWorkspace: React.FC<MechanicWorkspaceProps> = ({
  user,
  onSignOut,
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [openRequests, setOpenRequests] = useState<RepairRequest[]>([]);
  const [assignedRequests, setAssignedRequests] = useState<RepairRequest[]>([]);
  const [myQuotations, setMyQuotations] = useState<Quotation[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Quotation Modal/Drawer State
  const [selectedRequest, setSelectedRequest] = useState<RepairRequest | null>(null);
  const [quoteForm, setQuoteForm] = useState({
    estimatedRepairCost: '',
    spareParts: '',
    completionTimeDays: '3',
    estimatedAdditionalLifespanMonths: '24',
    repairDescription: '',
    notes: '',
  });
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);
  const [quoteFeedback, setQuoteFeedback] = useState<string | null>(null);

  // Repair Status Update State
  const [progressNotes, setProgressNotes] = useState<Record<string, string>>({});
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    action: () => Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsubOpen = subscribeOpenRequestsForMechanics((items) => {
      setOpenRequests(items);
      setLoading(false);
    });
    const unsubAssigned = subscribeMechanicAssignedRequests(
      user.uid,
      setAssignedRequests
    );
    const unsubQuotes = subscribeMechanicQuotations(user.uid, setMyQuotations);
    const unsubNotifs = subscribeUserNotifications(user.uid, setNotifications);

    return () => {
      unsubOpen();
      unsubAssigned();
      unsubQuotes();
      unsubNotifs();
    };
  }, [user.uid]);

  const acceptedCount = myQuotations.filter((q) => q.status === 'ACCEPTED').length;
  const inProgressCount = assignedRequests.filter(
    (r) => r.status === 'QUOTATION_ACCEPTED' || r.status === 'REPAIR_IN_PROGRESS'
  ).length;
  const completedCount = assignedRequests.filter(
    (r) => r.status === 'REPAIR_COMPLETED'
  ).length;

  const navItems: NavItem[] = [
    { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
    {
      id: 'open-requests',
      label: 'Open Requests',
      Icon: ClipboardCheck,
      badgeCount: openRequests.length,
    },
    {
      id: 'my-quotations',
      label: 'My Quotations',
      Icon: FileSpreadsheet,
      badgeCount: myQuotations.length,
    },
    {
      id: 'active-repairs',
      label: 'Assigned Repairs',
      Icon: Wrench,
      badgeCount: inProgressCount,
    },
    { id: 'decision-engine', label: 'Decision Engine', Icon: Calculator },
  ];

  const quotedRequestIds = new Set(myQuotations.map((q) => q.requestId));

  const filteredOpenRequests = openRequests.filter((r) => {
    const matchesCategory =
      categoryFilter === 'ALL' || r.category === categoryFilter;
    const text =
      `${r.id} ${r.productName} ${r.brand} ${r.modelNumber} ${r.location}`.toLowerCase();
    const matchesSearch = text.includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleSubmitQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    setQuoteSubmitting(true);
    setQuoteFeedback(null);
    try {
      const qId = await submitQuotation({
        request: selectedRequest,
        mechanicId: user.uid,
        mechanicName: user.fullName,
        estimatedRepairCost: Number(quoteForm.estimatedRepairCost),
        spareParts: quoteForm.spareParts,
        completionTimeDays: Number(quoteForm.completionTimeDays),
        estimatedAdditionalLifespanMonths: Number(
          quoteForm.estimatedAdditionalLifespanMonths
        ),
        repairDescription: quoteForm.repairDescription,
        notes: quoteForm.notes,
      });
      setQuoteFeedback(
        `Quotation ${qId} submitted confidentially to ${selectedRequest.customerName}.`
      );
      setSelectedRequest(null);
      setQuoteForm({
        estimatedRepairCost: '',
        spareParts: '',
        completionTimeDays: '3',
        estimatedAdditionalLifespanMonths: '24',
        repairDescription: '',
        notes: '',
      });
    } catch (err) {
      setQuoteFeedback(
        err instanceof Error ? err.message : 'Unable to submit quotation.'
      );
    } finally {
      setQuoteSubmitting(false);
    }
  };

  const runConfirmedAction = async () => {
    if (!confirmState) return;
    setConfirmBusy(true);
    try {
      await confirmState.action();
      setConfirmState(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  return (
    <DashboardShell
      user={user}
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      notifications={notifications}
      onSignOut={onSignOut}
    >
      {quoteFeedback && (
        <div className="mb-6 p-3.5 text-sm text-teal-900 bg-teal-50 border border-teal-200 rounded-xl flex items-center justify-between gap-4">
          <span>{quoteFeedback}</span>
          <button
            type="button"
            onClick={() => setQuoteFeedback(null)}
            className="text-xs font-semibold text-teal-700 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-navy-950 tracking-tight">
                Mechanic Workbench
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Review open repair tickets, submit private quotations, and manage active
                service jobs.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('open-requests')}
              className="px-4 py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              Browse Open Requests
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map((k) => (
                <div
                  key={k}
                  className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-xs font-medium text-slate-500">
                  Open Repair Requests
                </div>
                <div className="text-3xl font-bold font-mono tabular-nums text-navy-950 mt-2">
                  {openRequests.length}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-xs font-medium text-slate-500">
                  Submitted Quotations
                </div>
                <div className="text-3xl font-bold font-mono tabular-nums text-navy-900 mt-2">
                  {myQuotations.length}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-xs font-medium text-slate-500">
                  Accepted Quotations
                </div>
                <div className="text-3xl font-bold font-mono tabular-nums text-teal-700 mt-2">
                  {acceptedCount}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-xs font-medium text-slate-500">
                  Repairs In Progress
                </div>
                <div className="text-3xl font-bold font-mono tabular-nums text-amber-700 mt-2">
                  {inProgressCount}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-xs font-medium text-slate-500">
                  Completed Repairs
                </div>
                <div className="text-3xl font-bold font-mono tabular-nums text-emerald-700 mt-2">
                  {completedCount}
                </div>
              </div>
            </div>
          )}

          {/* Assigned Jobs Summary */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-navy-950">
                Active Assigned Repairs
              </h2>
              <button
                type="button"
                onClick={() => setActiveTab('active-repairs')}
                className="text-xs font-semibold text-teal-700 hover:text-teal-800 cursor-pointer"
              >
                Manage All
              </button>
            </div>
            {assignedRequests.length === 0 ? (
              <p className="text-sm text-slate-500">
                No accepted repair jobs yet. Submit quotations on open requests to win
                service jobs.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {assignedRequests.slice(0, 5).map((r) => (
                  <div
                    key={r.id}
                    className="py-3 flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="text-sm font-semibold text-navy-950">
                        {r.brand} {r.productName} ({r.id})
                      </div>
                      <div className="text-xs text-slate-500">
                        Customer: {r.customerName} · {r.location}
                      </div>
                    </div>
                    <StatusText status={r.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: OPEN REPAIR REQUESTS */}
      {activeTab === 'open-requests' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-navy-950 tracking-tight">
                Open Repair Requests
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Quotations are strictly confidential—only you and the customer can see
                your submitted quote.
              </p>
            </div>
          </div>

          {/* Search & Category Filter */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by product, brand, model, or location..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              <option value="ALL">All Categories</option>
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {filteredOpenRequests.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
              No open repair requests match your current filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {filteredOpenRequests.map((req) => {
                const alreadyQuoted = quotedRequestIds.has(req.id);
                return (
                  <div
                    key={req.id}
                    className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="font-mono font-semibold text-teal-700">
                              {req.id}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{req.category}</span>
                            <span aria-hidden="true">·</span>
                            <span>{req.location}</span>
                          </div>
                          <h3 className="text-base font-semibold text-navy-950 mt-0.5">
                            {req.brand} {req.productName} ({req.modelNumber})
                          </h3>
                        </div>
                        <StatusText status={req.status} />
                      </div>

                      {req.imageUrl && (
                        <img
                          src={req.imageUrl}
                          alt={req.productName}
                          referrerPolicy="no-referrer"
                          className="w-full h-40 object-cover rounded-lg border border-slate-200"
                        />
                      )}

                      <p className="text-sm text-slate-700 leading-relaxed">
                        {req.problemDescription}
                      </p>

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-xs">
                        <div>
                          <span className="text-slate-500 block">Age</span>
                          <span className="font-mono font-semibold text-navy-950">
                            {req.productAgeYears} yrs
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Prior Repairs</span>
                          <span className="font-mono font-semibold text-navy-950">
                            {req.previousRepairCount} (${req.previousRepairCost})
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Recurring Fault</span>
                          <span className="font-semibold text-navy-950">
                            {req.recurringFault ? 'Yes' : 'No'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-500">
                        Customer: {req.customerName}
                      </span>
                      {alreadyQuoted ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700">
                          <CheckCircle2 className="w-4 h-4" />
                          Quotation Submitted
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRequest(req);
                            setQuoteFeedback(null);
                          }}
                          className="px-4 py-2 text-xs font-semibold text-white bg-navy-900 hover:bg-navy-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Submit Quotation
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MY QUOTATIONS */}
      {activeTab === 'my-quotations' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-navy-950 tracking-tight">
              My Submitted Quotations
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Track the status of your confidential quotations. Competing mechanics&apos;
              bids are never visible.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {myQuotations.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                You have not submitted any quotations yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4">Quote ID</th>
                      <th className="py-3 px-4">Request &amp; Product</th>
                      <th className="py-3 px-4 text-right">Quoted Cost</th>
                      <th className="py-3 px-4">Spare Parts</th>
                      <th className="py-3 px-4 text-right">Turnaround</th>
                      <th className="py-3 px-4 text-right">Lifespan</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {myQuotations.map((q) => (
                      <tr key={q.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-mono text-xs text-teal-700 font-semibold">
                          {q.id}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-navy-950">
                            {q.productName}
                          </div>
                          <div className="text-xs font-mono text-slate-500">
                            {q.requestId}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-navy-950">
                          ${q.estimatedRepairCost.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 max-w-[200px]">
                          {q.spareParts}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          {q.completionTimeDays} d
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-teal-700">
                          +{q.estimatedAdditionalLifespanMonths} mo
                        </td>
                        <td className="py-3 px-4">
                          <StatusText status={q.status} />
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                          {formatTimestamp(q.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: ASSIGNED REPAIRS */}
      {activeTab === 'active-repairs' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-navy-950 tracking-tight">
              Assigned Repairs &amp; Status Updates
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Advance accepted repairs cleanly along the validated RepairTracker
              workflow.
            </p>
          </div>

          {assignedRequests.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
              No repairs have been assigned to your account yet.
            </div>
          ) : (
            <div className="space-y-5">
              {assignedRequests.map((req) => (
                <div
                  key={req.id}
                  className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono font-semibold text-teal-700">
                          {req.id}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Customer: {req.customerName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono font-semibold text-navy-950">
                          Accepted: ${(req.acceptedCost ?? 0).toFixed(2)}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-navy-950 mt-0.5">
                        {req.brand} {req.productName} ({req.modelNumber})
                      </h3>
                      <p className="text-xs text-slate-600 mt-1">
                        {req.problemDescription}
                      </p>
                    </div>
                    <StatusText status={req.status} />
                  </div>

                  <RepairTimeline status={req.status} />

                  {(req.status === 'QUOTATION_ACCEPTED' ||
                    req.status === 'REPAIR_IN_PROGRESS') && (
                    <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
                      <input
                        type="text"
                        value={progressNotes[req.id] || ''}
                        onChange={(e) =>
                          setProgressNotes((p) => ({
                            ...p,
                            [req.id]: e.target.value,
                          }))
                        }
                        placeholder="Add progress note for the customer (optional)..."
                        className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                      />
                      {req.status === 'QUOTATION_ACCEPTED' && (
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmState({
                              open: true,
                              title: 'Start Repair?',
                              description: `Mark ${req.id} as REPAIR IN PROGRESS and notify ${req.customerName}?`,
                              confirmLabel: 'Mark In Progress',
                              action: async () => {
                                await updateRepairProgressByMechanic(
                                  req,
                                  'REPAIR_IN_PROGRESS',
                                  progressNotes[req.id] ||
                                    'Diagnostics and component replacement started.'
                                );
                              },
                            })
                          }
                          className="px-4 py-2 text-sm font-semibold text-white bg-navy-900 hover:bg-navy-800 rounded-lg cursor-pointer whitespace-nowrap"
                        >
                          Start Repair
                        </button>
                      )}
                      {req.status === 'REPAIR_IN_PROGRESS' && (
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmState({
                              open: true,
                              title: 'Complete Repair?',
                              description: `Mark ${req.id} as REPAIR COMPLETED and notify ${req.customerName}?`,
                              confirmLabel: 'Mark Completed',
                              action: async () => {
                                await updateRepairProgressByMechanic(
                                  req,
                                  'REPAIR_COMPLETED',
                                  progressNotes[req.id] ||
                                    'Repair completed and quality-tested.'
                                );
                              },
                            })
                          }
                          className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg cursor-pointer whitespace-nowrap"
                        >
                          Complete Repair
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: DECISION ENGINE */}
      {activeTab === 'decision-engine' && <DecisionEngineView userId={user.uid} />}

      {/* SUBMIT QUOTATION MODAL */}
      {selectedRequest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="text-xs font-mono font-semibold text-teal-700">
                  {selectedRequest.id}
                </div>
                <h2 className="text-lg font-bold text-navy-950">
                  Submit Quotation — {selectedRequest.brand}{' '}
                  {selectedRequest.productName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSubmitQuotation} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Estimated Cost ($)
                  </label>
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    required
                    value={quoteForm.estimatedRepairCost}
                    onChange={(e) =>
                      setQuoteForm((p) => ({
                        ...p,
                        estimatedRepairCost: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Completion (Days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    required
                    value={quoteForm.completionTimeDays}
                    onChange={(e) =>
                      setQuoteForm((p) => ({
                        ...p,
                        completionTimeDays: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Extra Lifespan (Mo)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={240}
                    required
                    value={quoteForm.estimatedAdditionalLifespanMonths}
                    onChange={(e) =>
                      setQuoteForm((p) => ({
                        ...p,
                        estimatedAdditionalLifespanMonths: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Required Spare Parts
                </label>
                <input
                  type="text"
                  required
                  value={quoteForm.spareParts}
                  onChange={(e) =>
                    setQuoteForm((p) => ({ ...p, spareParts: e.target.value }))
                  }
                  placeholder="e.g. OEM Power Management IC, Thermal Compound"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Repair Description
                </label>
                <textarea
                  required
                  minLength={5}
                  rows={3}
                  value={quoteForm.repairDescription}
                  onChange={(e) =>
                    setQuoteForm((p) => ({
                      ...p,
                      repairDescription: e.target.value,
                    }))
                  }
                  placeholder="Outline diagnostic work, replacement procedure, and testing..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={quoteForm.notes}
                  onChange={(e) =>
                    setQuoteForm((p) => ({ ...p, notes: e.target.value }))
                  }
                  placeholder="e.g. Includes 6-month parts & labor warranty"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedRequest(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quoteSubmitting}
                  className="px-5 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg cursor-pointer disabled:opacity-60"
                >
                  {quoteSubmitting ? 'Submitting...' : 'Send Quotation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmState && (
        <ConfirmDialog
          open={confirmState.open}
          title={confirmState.title}
          description={confirmState.description}
          confirmLabel={confirmState.confirmLabel}
          loading={confirmBusy}
          onConfirm={runConfirmedAction}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </DashboardShell>
  );
};
