import React, { useEffect, useState } from 'react';
import {
  Calculator,
  CheckCircle2,
  ClipboardList,
  GitCompare,
  LayoutDashboard,
  PlusCircle,
  ShieldCheck,
  Store,
  Tag,
  Trash2,
  Upload,
  Wrench,
} from 'lucide-react';
import {
  acceptQuotationAtomic,
  acceptVendorOfferAtomic,
  calculateWarrantyExpiry,
  cancelRepairRequest,
  compressImageToDataUrl,
  createRepairRequest,
  createResaleListing,
  createWarrantyRecord,
  deleteResaleListing,
  deleteWarrantyRecord,
  formatTimestamp,
  getWarrantyStatus,
  rejectSingleQuotation,
  rejectSingleVendorOffer,
  subscribeCustomerListings,
  subscribeCustomerQuotations,
  subscribeCustomerRequests,
  subscribeSellerOffers,
  subscribeSellerPurchases,
  subscribeUserNotifications,
  subscribeUserWarranties,
} from '../services/firestoreService';
import {
  DecisionInput,
  NotificationItem,
  PRODUCT_CATEGORIES,
  ProductCondition,
  PurchaseRecord,
  Quotation,
  RepairRequest,
  ResaleListing,
  UserProfile,
  VendorOffer,
  WarrantyRecord,
} from '../types/repairloop';
import { ConfirmDialog } from './ConfirmDialog';
import { DashboardShell, NavItem } from './DashboardShell';
import { DecisionEngineView } from './DecisionEngineView';
import { RepairTimeline } from './RepairTimeline';
import { StatusText } from './StatusText';

interface CustomerWorkspaceProps {
  user: UserProfile;
  onSignOut: () => void;
}

const STUDIO_PRESETS = [
  {
    label: 'Laptop Studio Photo',
    url: '/src/assets/images/appliance_laptop_studio_1795191299779.jpg',
  },
  {
    label: 'Espresso Machine Photo',
    url: '/src/assets/images/appliance_espresso_studio_1795191300787.jpg',
  },
  {
    label: 'Air Purifier Photo',
    url: '/src/assets/images/appliance_purifier_studio_1795191300120.jpg',
  },
];

export const CustomerWorkspace: React.FC<CustomerWorkspaceProps> = ({
  user,
  onSignOut,
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<RepairRequest[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [warranties, setWarranties] = useState<WarrantyRecord[]>([]);
  const [listings, setListings] = useState<ResaleListing[]>([]);
  const [offers, setOffers] = useState<VendorOffer[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [decisionPrefill, setDecisionPrefill] = useState<Partial<DecisionInput> | undefined>(
    undefined
  );

  // Repair Request Form State
  const [reqForm, setReqForm] = useState({
    category: PRODUCT_CATEGORIES[0] as string,
    productName: '',
    brand: '',
    modelNumber: '',
    productAgeYears: '2',
    purchaseDate: '2024-05-15',
    originalPrice: '999',
    replacementPrice: '950',
    previousRepairCount: '0',
    previousRepairCost: '0',
    recurringFault: false,
    problemDescription: '',
    location: '',
    imageUrl: '',
  });
  const [reqSubmitting, setReqSubmitting] = useState(false);
  const [reqFeedback, setReqFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Warranty Form State
  const [warForm, setWarForm] = useState({
    productName: '',
    brand: '',
    serialOrImei: '',
    purchaseDate: '2025-02-01',
    warrantyDurationMonths: '24',
    purchasePrice: '650',
  });
  const [warSubmitting, setWarSubmitting] = useState(false);
  const [warError, setWarError] = useState<string | null>(null);

  // Resale Listing Form State
  const [listForm, setListForm] = useState({
    productName: '',
    category: PRODUCT_CATEGORIES[0] as string,
    brand: '',
    model: '',
    ageYears: '2',
    condition: 'GOOD' as ProductCondition,
    expectedPrice: '380',
    location: '',
    description: '',
    imageUrl: '',
  });
  const [listSubmitting, setListSubmitting] = useState(false);
  const [listFeedback, setListFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Action Confirmation Modal State
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    tone: 'primary' | 'danger';
    action: () => Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubReqs = subscribeCustomerRequests(user.uid, (items) => {
      setRequests(items);
      setLoading(false);
    });
    const unsubQuotes = subscribeCustomerQuotations(user.uid, setQuotations);
    const unsubWar = subscribeUserWarranties(user.uid, setWarranties);
    const unsubListings = subscribeCustomerListings(user.uid, setListings);
    const unsubOffers = subscribeSellerOffers(user.uid, setOffers);
    const unsubPurchases = subscribeSellerPurchases(user.uid, setPurchases);
    const unsubNotifs = subscribeUserNotifications(user.uid, setNotifications);

    return () => {
      unsubReqs();
      unsubQuotes();
      unsubWar();
      unsubListings();
      unsubOffers();
      unsubPurchases();
      unsubNotifs();
    };
  }, [user.uid]);

  const pendingQuotesCount = quotations.filter((q) => q.status === 'PENDING').length;
  const inProgressCount = requests.filter(
    (r) => r.status === 'QUOTATION_ACCEPTED' || r.status === 'REPAIR_IN_PROGRESS'
  ).length;
  const completedCount = requests.filter((r) => r.status === 'REPAIR_COMPLETED').length;
  const pendingOffersCount = offers.filter((o) => o.status === 'PENDING').length;

  const navItems: NavItem[] = [
    { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
    { id: 'request-repair', label: 'Request Repair', Icon: PlusCircle },
    {
      id: 'quotations',
      label: 'Compare Quotations',
      Icon: GitCompare,
      badgeCount: pendingQuotesCount,
    },
    {
      id: 'tracking',
      label: 'Track Repairs',
      Icon: Wrench,
      badgeCount: inProgressCount,
    },
    { id: 'warranties', label: 'Warranty Register', Icon: ShieldCheck },
    {
      id: 'resale',
      label: 'Sell & Offers',
      Icon: Store,
      badgeCount: pendingOffersCount,
    },
    { id: 'decision-engine', label: 'Decision Engine', Icon: Calculator },
  ];

  const handleImageFileChange = async (
    file: File | undefined,
    target: 'repair' | 'listing'
  ) => {
    if (!file) return;
    try {
      const dataUrl = await compressImageToDataUrl(file);
      if (target === 'repair') {
        setReqForm((prev) => ({ ...prev, imageUrl: dataUrl }));
      } else {
        setListForm((prev) => ({ ...prev, imageUrl: dataUrl }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to process image.';
      if (target === 'repair') {
        setReqFeedback({ type: 'error', text: msg });
      } else {
        setListFeedback({ type: 'error', text: msg });
      }
    }
  };

  const handleCreateRepairRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setReqSubmitting(true);
    setReqFeedback(null);
    try {
      const newId = await createRepairRequest({
        customerId: user.uid,
        customerName: user.fullName,
        category: reqForm.category,
        productName: reqForm.productName,
        brand: reqForm.brand,
        modelNumber: reqForm.modelNumber,
        productAgeYears: Number(reqForm.productAgeYears),
        purchaseDate: reqForm.purchaseDate,
        originalPrice: Number(reqForm.originalPrice),
        replacementPrice: Number(reqForm.replacementPrice),
        previousRepairCount: Number(reqForm.previousRepairCount),
        previousRepairCost: Number(reqForm.previousRepairCost),
        recurringFault: reqForm.recurringFault,
        problemDescription: reqForm.problemDescription,
        location: reqForm.location,
        imageUrl: reqForm.imageUrl || undefined,
      });
      setReqFeedback({
        type: 'success',
        text: `Repair request ${newId} created and broadcast to verified mechanics.`,
      });
      setReqForm({
        category: PRODUCT_CATEGORIES[0],
        productName: '',
        brand: '',
        modelNumber: '',
        productAgeYears: '2',
        purchaseDate: '2024-05-15',
        originalPrice: '999',
        replacementPrice: '950',
        previousRepairCount: '0',
        previousRepairCost: '0',
        recurringFault: false,
        problemDescription: '',
        location: '',
        imageUrl: '',
      });
    } catch (err) {
      setReqFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to create repair request.',
      });
    } finally {
      setReqSubmitting(false);
    }
  };

  const handleAddWarranty = async (e: React.FormEvent) => {
    e.preventDefault();
    setWarSubmitting(true);
    setWarError(null);
    try {
      await createWarrantyRecord(user.uid, {
        productName: warForm.productName,
        brand: warForm.brand,
        serialOrImei: warForm.serialOrImei,
        purchaseDate: warForm.purchaseDate,
        warrantyDurationMonths: Number(warForm.warrantyDurationMonths),
        purchasePrice: Number(warForm.purchasePrice),
      });
      setWarForm({
        productName: '',
        brand: '',
        serialOrImei: '',
        purchaseDate: '2025-02-01',
        warrantyDurationMonths: '24',
        purchasePrice: '650',
      });
    } catch (err) {
      setWarError(err instanceof Error ? err.message : 'Unable to save warranty.');
    } finally {
      setWarSubmitting(false);
    }
  };

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    setListSubmitting(true);
    setListFeedback(null);
    try {
      const id = await createResaleListing({
        sellerId: user.uid,
        sellerName: user.fullName,
        productName: listForm.productName,
        category: listForm.category,
        brand: listForm.brand,
        model: listForm.model,
        ageYears: Number(listForm.ageYears),
        condition: listForm.condition,
        expectedPrice: Number(listForm.expectedPrice),
        location: listForm.location,
        description: listForm.description,
        imageUrl: listForm.imageUrl || undefined,
      });
      setListFeedback({
        type: 'success',
        text: `Listing ${id} published on the RepairLoop Resale Marketplace.`,
      });
      setListForm({
        productName: '',
        category: PRODUCT_CATEGORIES[0],
        brand: '',
        model: '',
        ageYears: '2',
        condition: 'GOOD',
        expectedPrice: '380',
        location: '',
        description: '',
        imageUrl: '',
      });
    } catch (err) {
      setListFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to publish resale listing.',
      });
    } finally {
      setListSubmitting(false);
    }
  };

  const runConfirmedAction = async () => {
    if (!confirmState) return;
    setConfirmBusy(true);
    setActionMessage(null);
    try {
      await confirmState.action();
      setConfirmState(null);
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Operation failed.');
    } finally {
      setConfirmBusy(false);
    }
  };

  // Status chart numbers
  const pendingReqCount = requests.filter(
    (r) => r.status === 'PENDING' || r.status === 'QUOTATION_RECEIVED'
  ).length;
  const maxChartVal = Math.max(1, pendingReqCount, inProgressCount, completedCount);

  return (
    <DashboardShell
      user={user}
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={(tab) => {
        setActiveTab(tab);
        setActionMessage(null);
      }}
      notifications={notifications}
      onSignOut={onSignOut}
    >
      {actionMessage && (
        <div className="mb-6 p-3.5 text-sm text-teal-900 bg-teal-50 border border-teal-200 rounded-xl flex items-center justify-between gap-4">
          <span>{actionMessage}</span>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="text-xs font-semibold text-teal-700 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 1: CUSTOMER OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-navy-950 tracking-tight">
                Welcome back, {user.fullName}
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Manage appliance repairs, compare quotations, track warranties, and sell
                devices responsibly.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('request-repair')}
              className="px-4 py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Request Repair</span>
            </button>
          </div>

          {/* 4 KPI Cards */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((k) => (
                <div
                  key={k}
                  className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-xs font-medium text-slate-500">
                  Total Repair Requests
                </div>
                <div className="text-3xl font-bold font-mono tabular-nums text-navy-950 mt-2">
                  {requests.length}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  All submitted service tickets
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-xs font-medium text-slate-500">
                  Pending Quotations
                </div>
                <div className="text-3xl font-bold font-mono tabular-nums text-teal-700 mt-2">
                  {pendingQuotesCount}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Awaiting your selection
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-xs font-medium text-slate-500">
                  Repairs In Progress
                </div>
                <div className="text-3xl font-bold font-mono tabular-nums text-navy-900 mt-2">
                  {inProgressCount}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Assigned or actively serviced
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-xs font-medium text-slate-500">
                  Completed Repairs
                </div>
                <div className="text-3xl font-bold font-mono tabular-nums text-emerald-700 mt-2">
                  {completedCount}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Extended product lifespans
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-navy-950 mb-4">
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { id: 'request-repair', label: 'Request Repair', Icon: PlusCircle },
                { id: 'quotations', label: 'Compare Quotations', Icon: GitCompare },
                { id: 'tracking', label: 'Track Repairs', Icon: Wrench },
                { id: 'warranties', label: 'Warranty Register', Icon: ShieldCheck },
                { id: 'resale', label: 'Sell Product', Icon: Store },
              ].map((action) => {
                const Icon = action.Icon;
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => setActiveTab(action.id)}
                    className="p-4 rounded-xl border border-slate-200 hover:border-teal-600 hover:bg-teal-50/40 text-left transition-colors cursor-pointer group"
                  >
                    <Icon className="w-5 h-5 text-teal-600 mb-2" />
                    <div className="text-sm font-semibold text-navy-950 group-hover:text-teal-800">
                      {action.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Clean Pipeline Chart */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="text-base font-semibold text-navy-950 mb-1">
                Repair Pipeline Summary
              </h2>
              <p className="text-xs text-slate-500 mb-5">
                Live breakdown of your active repair lifecycle stages
              </p>
              <div className="space-y-4">
                {[
                  { label: 'Awaiting Selection', count: pendingReqCount, color: 'bg-amber-500' },
                  { label: 'In Service', count: inProgressCount, color: 'bg-teal-600' },
                  { label: 'Completed', count: completedCount, color: 'bg-navy-900' },
                ].map((bar) => (
                  <div key={bar.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-slate-700">{bar.label}</span>
                      <span className="font-mono tabular-nums text-navy-950">
                        {bar.count}
                      </span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${bar.color} rounded-full transition-all`}
                        style={{
                          width: `${Math.max(bar.count > 0 ? 10 : 0, (bar.count / maxChartVal) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="text-base font-semibold text-navy-950 mb-4">
                Recent Activity
              </h2>
              {requests.length === 0 && listings.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-slate-500 mb-3">
                    No repair requests or resale listings created yet.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('request-repair')}
                    className="px-4 py-2 text-xs font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800 cursor-pointer"
                  >
                    Submit Your First Repair Request
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {requests.slice(0, 4).map((r) => (
                    <div
                      key={r.id}
                      className="py-3 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-navy-950 truncate">
                          {r.brand} {r.productName}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                          <span className="font-mono">{r.id}</span>
                          <span aria-hidden="true">·</span>
                          <span>{r.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>{formatTimestamp(r.createdAt)}</span>
                        </div>
                      </div>
                      <StatusText status={r.status} />
                    </div>
                  ))}
                  {listings.slice(0, 2).map((l) => (
                    <div
                      key={l.id}
                      className="py-3 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-navy-950 truncate">
                          Resale: {l.brand} {l.productName}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                          <span className="font-mono">{l.id}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            Asking ${l.expectedPrice.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <StatusText status={l.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REQUEST REPAIR */}
      {activeTab === 'request-repair' && (
        <div className="max-w-4xl space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-navy-950 tracking-tight">
              Submit Repair Request
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Provide accurate product details and prior repair history so mechanics can
              quote accurately.
            </p>
          </div>

          <form
            onSubmit={handleCreateRepairRequest}
            className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Category
                </label>
                <select
                  value={reqForm.category}
                  onChange={(e) =>
                    setReqForm((p) => ({ ...p, category: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  {PRODUCT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Product Name
                </label>
                <input
                  type="text"
                  required
                  value={reqForm.productName}
                  onChange={(e) =>
                    setReqForm((p) => ({ ...p, productName: e.target.value }))
                  }
                  placeholder="e.g. MacBook Pro 14 / Front-Load Washer"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Brand
                </label>
                <input
                  type="text"
                  required
                  value={reqForm.brand}
                  onChange={(e) =>
                    setReqForm((p) => ({ ...p, brand: e.target.value }))
                  }
                  placeholder="e.g. Dell, LG, Breville"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Model Number
                </label>
                <input
                  type="text"
                  required
                  value={reqForm.modelNumber}
                  onChange={(e) =>
                    setReqForm((p) => ({ ...p, modelNumber: e.target.value }))
                  }
                  placeholder="e.g. XPS-9320"
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Product Age (Years)
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  step="0.5"
                  required
                  value={reqForm.productAgeYears}
                  onChange={(e) =>
                    setReqForm((p) => ({ ...p, productAgeYears: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Purchase Date
                </label>
                <input
                  type="date"
                  required
                  value={reqForm.purchaseDate}
                  onChange={(e) =>
                    setReqForm((p) => ({ ...p, purchaseDate: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Original Purchase Price ($)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={reqForm.originalPrice}
                  onChange={(e) =>
                    setReqForm((p) => ({ ...p, originalPrice: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Estimated Replacement Price ($)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={reqForm.replacementPrice}
                  onChange={(e) =>
                    setReqForm((p) => ({ ...p, replacementPrice: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Previous Repair Count
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  required
                  value={reqForm.previousRepairCount}
                  onChange={(e) =>
                    setReqForm((p) => ({ ...p, previousRepairCount: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Previous Repair Cost ($)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={reqForm.previousRepairCost}
                  onChange={(e) =>
                    setReqForm((p) => ({ ...p, previousRepairCost: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Service Location (City / Neighborhood)
                </label>
                <input
                  type="text"
                  required
                  value={reqForm.location}
                  onChange={(e) =>
                    setReqForm((p) => ({ ...p, location: e.target.value }))
                  }
                  placeholder="e.g. Austin, TX"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <label className="flex items-center gap-2.5 pt-5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reqForm.recurringFault}
                  onChange={(e) =>
                    setReqForm((p) => ({ ...p, recurringFault: e.target.checked }))
                  }
                  className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600"
                />
                <span className="text-sm text-slate-700">
                  Recurring fault (issue returned after earlier service)
                </span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Problem Description
              </label>
              <textarea
                required
                minLength={5}
                rows={3}
                value={reqForm.problemDescription}
                onChange={(e) =>
                  setReqForm((p) => ({ ...p, problemDescription: e.target.value }))
                }
                placeholder="Describe symptoms, error codes, noises, or power issues..."
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            {/* Optional Image Upload */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Optional Product Photo
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-navy-950 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Image</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) =>
                      handleImageFileChange(e.target.files?.[0], 'repair')
                    }
                  />
                </label>
                {STUDIO_PRESETS.map((preset) => (
                  <button
                    key={preset.url}
                    type="button"
                    onClick={() =>
                      setReqForm((p) => ({ ...p, imageUrl: preset.url }))
                    }
                    className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-navy-950 border border-slate-200 rounded-lg cursor-pointer"
                  >
                    Use {preset.label}
                  </button>
                ))}
                {reqForm.imageUrl && (
                  <button
                    type="button"
                    onClick={() => setReqForm((p) => ({ ...p, imageUrl: '' }))}
                    className="text-xs font-medium text-red-600 hover:text-red-700 cursor-pointer"
                  >
                    Remove Photo
                  </button>
                )}
              </div>
              {reqForm.imageUrl && (
                <img
                  src={reqForm.imageUrl}
                  alt="Selected product preview"
                  referrerPolicy="no-referrer"
                  className="h-32 w-48 object-cover rounded-lg border border-slate-200 mt-2"
                />
              )}
            </div>

            {reqFeedback && (
              <div
                className={`p-3.5 text-sm rounded-lg border ${
                  reqFeedback.type === 'success'
                    ? 'bg-teal-50 border-teal-200 text-teal-900'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                {reqFeedback.text}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={reqSubmitting}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-navy-900 hover:bg-navy-800 rounded-lg transition-colors cursor-pointer disabled:opacity-60"
              >
                {reqSubmitting ? 'Submitting Request...' : 'Submit Repair Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: COMPARE QUOTATIONS */}
      {activeTab === 'quotations' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-navy-950 tracking-tight">
              Compare Mechanic Quotations
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Review submitted bids side-by-side. Accepting one quotation automatically
              closes competing bids and notifies the selected mechanic.
            </p>
          </div>

          {requests.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
              <ClipboardList className="w-8 h-8 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-navy-950">
                No Repair Requests Yet
              </h3>
              <p className="text-sm text-slate-500 mt-1 mb-4">
                Submit a repair request first to receive mechanic quotations.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('request-repair')}
                className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg cursor-pointer"
              >
                Request Repair
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {requests.map((req) => {
                const reqQuotes = quotations.filter((q) => q.requestId === req.id);
                const canAcceptMore =
                  req.status === 'PENDING' || req.status === 'QUOTATION_RECEIVED';

                return (
                  <div
                    key={req.id}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden"
                  >
                    <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-xs font-semibold text-teal-700">
                            {req.id}
                          </span>
                          <span className="text-slate-300">·</span>
                          <h3 className="text-base font-semibold text-navy-950">
                            {req.brand} {req.productName} ({req.modelNumber})
                          </h3>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {req.problemDescription}
                        </p>
                      </div>
                      <StatusText status={req.status} />
                    </div>

                    {reqQuotes.length === 0 ? (
                      <div className="p-6 text-sm text-slate-500">
                        No mechanic quotations received yet for this request.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600">
                              <th className="py-3 px-4">Mechanic</th>
                              <th className="py-3 px-4 text-right">Repair Cost</th>
                              <th className="py-3 px-4">Spare Parts</th>
                              <th className="py-3 px-4 text-right">Turnaround</th>
                              <th className="py-3 px-4 text-right">Extra Lifespan</th>
                              <th className="py-3 px-4">Notes</th>
                              <th className="py-3 px-4">Status</th>
                              <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-sm">
                            {reqQuotes.map((q) => (
                              <tr key={q.id} className="hover:bg-slate-50/70">
                                <td className="py-3.5 px-4 font-medium text-navy-950">
                                  <div>{q.mechanicName}</div>
                                  <div className="text-xs text-slate-500 font-normal">
                                    {q.repairDescription}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-navy-950">
                                  ${q.estimatedRepairCost.toFixed(2)}
                                </td>
                                <td className="py-3.5 px-4 text-xs text-slate-700 max-w-[180px]">
                                  {q.spareParts}
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                                  {q.completionTimeDays} d
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono tabular-nums text-teal-700 whitespace-nowrap">
                                  +{q.estimatedAdditionalLifespanMonths} mo
                                </td>
                                <td className="py-3.5 px-4 text-xs text-slate-600 max-w-[180px]">
                                  {q.notes || '—'}
                                </td>
                                <td className="py-3.5 px-4">
                                  <StatusText status={q.status} />
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                  <div className="inline-flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDecisionPrefill({
                                          productName: `${req.brand} ${req.productName}`,
                                          originalPrice: req.originalPrice,
                                          productAgeYears: req.productAgeYears,
                                          repairCost: q.estimatedRepairCost,
                                          replacementCost: req.replacementPrice,
                                          additionalLifespanMonths:
                                            q.estimatedAdditionalLifespanMonths,
                                          previousRepairCount: req.previousRepairCount,
                                          previousRepairCost: req.previousRepairCost,
                                          recurringFault: req.recurringFault,
                                        });
                                        setActiveTab('decision-engine');
                                      }}
                                      className="px-2.5 py-1.5 text-xs font-medium text-navy-900 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer whitespace-nowrap"
                                    >
                                      Evaluate
                                    </button>
                                    {canAcceptMore && q.status === 'PENDING' && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setConfirmState({
                                              open: true,
                                              title: 'Accept Mechanic Quotation?',
                                              description: `Accept ${q.mechanicName}'s quotation for $${q.estimatedRepairCost.toFixed(2)}? All competing pending quotations for ${req.id} will be automatically rejected.`,
                                              confirmLabel: 'Accept Quotation',
                                              tone: 'primary',
                                              action: async () => {
                                                await acceptQuotationAtomic(
                                                  req,
                                                  q,
                                                  reqQuotes
                                                );
                                                setActionMessage(
                                                  `Quotation ${q.id} accepted. ${q.mechanicName} has been notified.`
                                                );
                                              },
                                            })
                                          }
                                          className="px-2.5 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-md cursor-pointer whitespace-nowrap"
                                        >
                                          Accept
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setConfirmState({
                                              open: true,
                                              title: 'Reject Quotation?',
                                              description: `Reject the quotation from ${q.mechanicName}?`,
                                              confirmLabel: 'Reject',
                                              tone: 'danger',
                                              action: async () => {
                                                await rejectSingleQuotation(q);
                                                setActionMessage(
                                                  `Quotation ${q.id} marked rejected.`
                                                );
                                              },
                                            })
                                          }
                                          className="px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-md cursor-pointer whitespace-nowrap"
                                        >
                                          Reject
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: REPAIR TRACKING */}
      {activeTab === 'tracking' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-navy-950 tracking-tight">
              Repair Tracking Timeline
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Monitor real-time service milestones from initial submission through final
              completion.
            </p>
          </div>

          {requests.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
              <Wrench className="w-8 h-8 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-navy-950">
                No Active Repairs
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Submitted repair requests and their 5-stage timelines will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      {req.imageUrl && (
                        <img
                          src={req.imageUrl}
                          alt={req.productName}
                          referrerPolicy="no-referrer"
                          className="w-16 h-16 rounded-lg object-cover border border-slate-200 shrink-0"
                        />
                      )}
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
                        <p className="text-xs text-slate-600 mt-1">
                          {req.problemDescription}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <StatusText status={req.status} />
                      {(req.status === 'PENDING' ||
                        req.status === 'QUOTATION_RECEIVED') && (
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmState({
                              open: true,
                              title: 'Cancel Repair Request?',
                              description: `Cancel request ${req.id}? This cannot be undone.`,
                              confirmLabel: 'Cancel Request',
                              tone: 'danger',
                              action: async () => {
                                await cancelRepairRequest(req.id);
                                setActionMessage(`Repair request ${req.id} cancelled.`);
                              },
                            })
                          }
                          className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
                        >
                          Cancel Request
                        </button>
                      )}
                    </div>
                  </div>

                  <RepairTimeline status={req.status} />

                  {(req.acceptedMechanicName || req.timelineNotes) && (
                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                      <div>
                        {req.acceptedMechanicName && (
                          <span>
                            Assigned Mechanic:{' '}
                            <strong className="text-navy-950">
                              {req.acceptedMechanicName}
                            </strong>
                            {typeof req.acceptedCost === 'number' && (
                              <span className="font-mono tabular-nums">
                                {' '}
                                (${req.acceptedCost.toFixed(2)})
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                      {req.timelineNotes && (
                        <div className="text-slate-600">
                          Latest Note: {req.timelineNotes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: WARRANTY REGISTER */}
      {activeTab === 'warranties' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-navy-950 tracking-tight">
              Warranty Register
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Keep serial numbers, purchase receipts, and automated expiry alerts in one
              place.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <form
              onSubmit={handleAddWarranty}
              className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
            >
              <h2 className="text-base font-semibold text-navy-950">
                Register Product Warranty
              </h2>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Name
                </label>
                <input
                  type="text"
                  required
                  value={warForm.productName}
                  onChange={(e) =>
                    setWarForm((p) => ({ ...p, productName: e.target.value }))
                  }
                  placeholder="e.g. OLED Smart TV 55"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Brand
                </label>
                <input
                  type="text"
                  required
                  value={warForm.brand}
                  onChange={(e) =>
                    setWarForm((p) => ({ ...p, brand: e.target.value }))
                  }
                  placeholder="e.g. LG"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Serial Number / IMEI
                </label>
                <input
                  type="text"
                  required
                  value={warForm.serialOrImei}
                  onChange={(e) =>
                    setWarForm((p) => ({ ...p, serialOrImei: e.target.value }))
                  }
                  placeholder="e.g. SN-9948271-LG"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Purchase Date
                  </label>
                  <input
                    type="date"
                    required
                    value={warForm.purchaseDate}
                    onChange={(e) =>
                      setWarForm((p) => ({ ...p, purchaseDate: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Duration (Months)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={240}
                    required
                    value={warForm.warrantyDurationMonths}
                    onChange={(e) =>
                      setWarForm((p) => ({
                        ...p,
                        warrantyDurationMonths: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Purchase Price ($)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={warForm.purchasePrice}
                  onChange={(e) =>
                    setWarForm((p) => ({ ...p, purchasePrice: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="text-xs text-slate-500">
                Calculated Expiry:{' '}
                <strong className="font-mono text-navy-950">
                  {calculateWarrantyExpiry(
                    warForm.purchaseDate,
                    Number(warForm.warrantyDurationMonths)
                  )}
                </strong>
              </div>

              {warError && (
                <div className="p-2.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
                  {warError}
                </div>
              )}

              <button
                type="submit"
                disabled={warSubmitting}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-navy-900 hover:bg-navy-800 rounded-lg transition-colors cursor-pointer disabled:opacity-60"
              >
                {warSubmitting ? 'Saving Warranty...' : 'Register Warranty'}
              </button>
            </form>

            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-base font-semibold text-navy-950">
                  Registered Warranties ({warranties.length})
                </h2>
              </div>
              {warranties.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500">
                  No warranties registered yet. Add your electronics or appliances on the
                  left to track coverage expiry.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        <th className="py-3 px-4">Product</th>
                        <th className="py-3 px-4">Serial / IMEI</th>
                        <th className="py-3 px-4">Purchased</th>
                        <th className="py-3 px-4">Expiry Date</th>
                        <th className="py-3 px-4 text-right">Price</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {warranties.map((w) => {
                        const info = getWarrantyStatus(w.expiryDate);
                        return (
                          <tr key={w.id} className="hover:bg-slate-50/80">
                            <td className="py-3 px-4">
                              <div className="font-medium text-navy-950">
                                {w.brand} {w.productName}
                              </div>
                              <div className="text-xs text-slate-500">
                                {w.warrantyDurationMonths} months coverage
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono text-xs text-slate-700">
                              {w.serialOrImei}
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                              {w.purchaseDate}
                            </td>
                            <td className="py-3 px-4 text-xs font-mono text-navy-950 whitespace-nowrap">
                              {w.expiryDate}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                              ${w.purchasePrice.toFixed(2)}
                            </td>
                            <td className="py-3 px-4">
                              <StatusText status={info.status} />
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                aria-label={`Delete warranty for ${w.productName}`}
                                onClick={() =>
                                  setConfirmState({
                                    open: true,
                                    title: 'Remove Warranty Record?',
                                    description: `Delete warranty entry for ${w.brand} ${w.productName}?`,
                                    confirmLabel: 'Delete',
                                    tone: 'danger',
                                    action: async () => {
                                      if (w.id) await deleteWarrantyRecord(w.id);
                                    },
                                  })
                                }
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded-md cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: RESALE MARKETPLACE & OFFERS */}
      {activeTab === 'resale' && (
        <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-navy-950 tracking-tight">
              Resale Marketplace &amp; Vendor Offers
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              List older or damaged devices for certified vendors to purchase, compare
              incoming offers, and close sales safely.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Create Resale Listing Form */}
            <form
              onSubmit={handleCreateListing}
              className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
            >
              <h2 className="text-base font-semibold text-navy-950 flex items-center gap-2">
                <Tag className="w-4 h-4 text-teal-600" />
                <span>List Product for Sale</span>
              </h2>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Product Name
                  </label>
                  <input
                    type="text"
                    required
                    value={listForm.productName}
                    onChange={(e) =>
                      setListForm((p) => ({ ...p, productName: e.target.value }))
                    }
                    placeholder="e.g. Barista Pro Espresso Machine"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={listForm.category}
                    onChange={(e) =>
                      setListForm((p) => ({ ...p, category: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
                  >
                    {PRODUCT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Condition
                  </label>
                  <select
                    value={listForm.condition}
                    onChange={(e) =>
                      setListForm((p) => ({
                        ...p,
                        condition: e.target.value as ProductCondition,
                      }))
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
                  >
                    <option value="LIKE_NEW">Like New</option>
                    <option value="GOOD">Good</option>
                    <option value="FAIR">Fair</option>
                    <option value="NEEDS_REPAIR">Needs Repair</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Brand
                  </label>
                  <input
                    type="text"
                    required
                    value={listForm.brand}
                    onChange={(e) =>
                      setListForm((p) => ({ ...p, brand: e.target.value }))
                    }
                    placeholder="e.g. Breville"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Model
                  </label>
                  <input
                    type="text"
                    required
                    value={listForm.model}
                    onChange={(e) =>
                      setListForm((p) => ({ ...p, model: e.target.value }))
                    }
                    placeholder="e.g. BES878"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Age (Years)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    step="0.5"
                    required
                    value={listForm.ageYears}
                    onChange={(e) =>
                      setListForm((p) => ({ ...p, ageYears: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Expected Price ($)
                  </label>
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    required
                    value={listForm.expectedPrice}
                    onChange={(e) =>
                      setListForm((p) => ({ ...p, expectedPrice: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  required
                  value={listForm.location}
                  onChange={(e) =>
                    setListForm((p) => ({ ...p, location: e.target.value }))
                  }
                  placeholder="e.g. Seattle, WA"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  required
                  minLength={5}
                  rows={3}
                  value={listForm.description}
                  onChange={(e) =>
                    setListForm((p) => ({ ...p, description: e.target.value }))
                  }
                  placeholder="Cosmetic condition, included accessories, or known faults..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Product Image (Optional)
                </label>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-navy-950 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) =>
                        handleImageFileChange(e.target.files?.[0], 'listing')
                      }
                    />
                  </label>
                  {STUDIO_PRESETS.map((preset) => (
                    <button
                      key={preset.url}
                      type="button"
                      onClick={() =>
                        setListForm((p) => ({ ...p, imageUrl: preset.url }))
                      }
                      className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-navy-950 border border-slate-200 rounded-lg cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                {listForm.imageUrl && (
                  <img
                    src={listForm.imageUrl}
                    alt="Resale listing preview"
                    referrerPolicy="no-referrer"
                    className="h-28 w-40 object-cover rounded-lg border border-slate-200"
                  />
                )}
              </div>

              {listFeedback && (
                <div
                  className={`p-3 text-xs rounded-lg border ${
                    listFeedback.type === 'success'
                      ? 'bg-teal-50 border-teal-200 text-teal-900'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}
                >
                  {listFeedback.text}
                </div>
              )}

              <button
                type="submit"
                disabled={listSubmitting}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors cursor-pointer disabled:opacity-60"
              >
                {listSubmitting ? 'Publishing Listing...' : 'Publish Resale Listing'}
              </button>
            </form>

            {/* Right: Listings & Vendor Offers */}
            <div className="lg:col-span-7 space-y-5">
              {listings.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
                  You have not listed any products for resale yet.
                </div>
              ) : (
                listings.map((listing) => {
                  const listingOffers = offers.filter(
                    (o) => o.listingId === listing.id
                  );
                  const purchase = purchases.find((p) => p.listingId === listing.id);

                  return (
                    <div
                      key={listing.id}
                      className="bg-white border border-slate-200 rounded-xl overflow-hidden"
                    >
                      <div className="p-5 flex flex-wrap items-start justify-between gap-4 border-b border-slate-100">
                        <div className="flex items-start gap-4">
                          {listing.imageUrl && (
                            <img
                              src={listing.imageUrl}
                              alt={listing.productName}
                              referrerPolicy="no-referrer"
                              className="w-20 h-16 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                          )}
                          <div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span className="font-mono font-semibold text-teal-700">
                                {listing.id}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{listing.condition.replace(/_/g, ' ')}</span>
                              <span aria-hidden="true">·</span>
                              <span>{listing.ageYears} yrs old</span>
                            </div>
                            <h3 className="text-base font-semibold text-navy-950 mt-0.5">
                              {listing.brand} {listing.productName} ({listing.model})
                            </h3>
                            <div className="text-xs text-slate-600 mt-1">
                              Asking{' '}
                              <span className="font-mono font-semibold text-navy-950">
                                ${listing.expectedPrice.toFixed(2)}
                              </span>{' '}
                              · {listing.location}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <StatusText status={listing.status} />
                          {listing.status !== 'SOLD' && (
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmState({
                                  open: true,
                                  title: 'Remove Resale Listing?',
                                  description: `Delete listing ${listing.id}?`,
                                  confirmLabel: 'Remove Listing',
                                  tone: 'danger',
                                  action: async () => {
                                    await deleteResaleListing(listing.id);
                                  },
                                })
                              }
                              className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {purchase && (
                        <div className="px-5 py-3 bg-emerald-50/70 border-b border-emerald-100 flex items-center gap-2 text-xs text-emerald-900">
                          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span>
                            Sold to <strong>{purchase.vendorName}</strong> for{' '}
                            <strong className="font-mono">
                              ${purchase.finalPrice.toFixed(2)}
                            </strong>{' '}
                            (Order ID: <span className="font-mono">{purchase.id}</span>)
                          </span>
                        </div>
                      )}

                      <div className="p-5">
                        <h4 className="text-xs font-semibold text-slate-600 mb-3">
                          Incoming Vendor Offers ({listingOffers.length})
                        </h4>
                        {listingOffers.length === 0 ? (
                          <p className="text-xs text-slate-500">
                            No vendor offers received yet.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {listingOffers.map((offer) => (
                              <div
                                key={offer.id}
                                className="p-3.5 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3"
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-navy-950">
                                      {offer.vendorName}
                                    </span>
                                    <span className="text-slate-300">·</span>
                                    <span className="text-sm font-bold font-mono tabular-nums text-teal-700">
                                      ${offer.offeredPrice.toFixed(2)}
                                    </span>
                                    <span className="text-slate-300">·</span>
                                    <span className="text-xs text-slate-500">
                                      {formatTimestamp(offer.createdAt)}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-600 mt-1">
                                    {offer.message}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2">
                                  <StatusText status={offer.status} />
                                  {listing.status !== 'SOLD' &&
                                    offer.status === 'PENDING' && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setConfirmState({
                                              open: true,
                                              title: 'Accept Vendor Offer?',
                                              description: `Sell ${listing.productName} to ${offer.vendorName} for $${offer.offeredPrice.toFixed(2)}? Competing offers will be rejected and the listing marked SOLD.`,
                                              confirmLabel: 'Accept & Sell',
                                              tone: 'primary',
                                              action: async () => {
                                                const purId =
                                                  await acceptVendorOfferAtomic(
                                                    listing,
                                                    offer,
                                                    listingOffers
                                                  );
                                                setActionMessage(
                                                  `Listing sold to ${offer.vendorName}. Purchase record ${purId} created.`
                                                );
                                              },
                                            })
                                          }
                                          className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-md cursor-pointer"
                                        >
                                          Accept
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setConfirmState({
                                              open: true,
                                              title: 'Reject Vendor Offer?',
                                              description: `Decline $${offer.offeredPrice.toFixed(2)} offer from ${offer.vendorName}?`,
                                              confirmLabel: 'Reject',
                                              tone: 'danger',
                                              action: async () => {
                                                await rejectSingleVendorOffer(offer);
                                              },
                                            })
                                          }
                                          className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-md cursor-pointer"
                                        >
                                          Reject
                                        </button>
                                      </>
                                    )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: DECISION ENGINE */}
      {activeTab === 'decision-engine' && (
        <DecisionEngineView userId={user.uid} initialInput={decisionPrefill} />
      )}

      {confirmState && (
        <ConfirmDialog
          open={confirmState.open}
          title={confirmState.title}
          description={confirmState.description}
          confirmLabel={confirmState.confirmLabel}
          tone={confirmState.tone}
          loading={confirmBusy}
          onConfirm={runConfirmedAction}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </DashboardShell>
  );
};
