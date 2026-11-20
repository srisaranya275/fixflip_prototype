import React, { useEffect, useState } from 'react';
import {
  Calculator,
  CheckCircle2,
  LayoutDashboard,
  PackageCheck,
  Search,
  ShoppingBag,
  Store,
} from 'lucide-react';
import {
  formatTimestamp,
  submitVendorOffer,
  subscribeAvailableListingsForVendors,
  subscribeUserNotifications,
  subscribeVendorOffers,
  subscribeVendorPurchases,
} from '../services/firestoreService';
import {
  NotificationItem,
  PRODUCT_CATEGORIES,
  PurchaseRecord,
  ResaleListing,
  UserProfile,
  VendorOffer,
} from '../types/repairloop';
import { DashboardShell, NavItem } from './DashboardShell';
import { DecisionEngineView } from './DecisionEngineView';
import { StatusText } from './StatusText';

interface VendorWorkspaceProps {
  user: UserProfile;
  onSignOut: () => void;
}

export const VendorWorkspace: React.FC<VendorWorkspaceProps> = ({
  user,
  onSignOut,
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<ResaleListing[]>([]);
  const [myOffers, setMyOffers] = useState<VendorOffer[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Offer Modal State
  const [selectedListing, setSelectedListing] = useState<ResaleListing | null>(null);
  const [offerForm, setOfferForm] = useState({
    offeredPrice: '',
    message: '',
  });
  const [offerSubmitting, setOfferSubmitting] = useState(false);
  const [offerFeedback, setOfferFeedback] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubListings = subscribeAvailableListingsForVendors((items) => {
      setListings(items);
      setLoading(false);
    });
    const unsubOffers = subscribeVendorOffers(user.uid, setMyOffers);
    const unsubPurchases = subscribeVendorPurchases(user.uid, setPurchases);
    const unsubNotifs = subscribeUserNotifications(user.uid, setNotifications);

    return () => {
      unsubListings();
      unsubOffers();
      unsubPurchases();
      unsubNotifs();
    };
  }, [user.uid]);

  const acceptedOffers = myOffers.filter((o) => o.status === 'ACCEPTED');
  const myOfferedListingIds = new Set(myOffers.map((o) => o.listingId));

  const navItems: NavItem[] = [
    { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
    {
      id: 'marketplace',
      label: 'Available Products',
      Icon: Store,
      badgeCount: listings.length,
    },
    {
      id: 'my-offers',
      label: 'My Offers',
      Icon: ShoppingBag,
      badgeCount: myOffers.length,
    },
    {
      id: 'purchased',
      label: 'Purchased Products',
      Icon: PackageCheck,
      badgeCount: purchases.length,
    },
    { id: 'decision-engine', label: 'Decision Engine', Icon: Calculator },
  ];

  const filteredListings = listings.filter((l) => {
    const matchesCategory =
      categoryFilter === 'ALL' || l.category === categoryFilter;
    const text =
      `${l.id} ${l.productName} ${l.brand} ${l.model} ${l.location}`.toLowerCase();
    return matchesCategory && text.includes(searchTerm.toLowerCase());
  });

  const handleSubmitOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListing) return;
    setOfferSubmitting(true);
    setOfferFeedback(null);
    try {
      const offerId = await submitVendorOffer({
        listing: selectedListing,
        vendorId: user.uid,
        vendorName: user.fullName,
        offeredPrice: Number(offerForm.offeredPrice),
        message: offerForm.message,
      });
      setOfferFeedback(
        `Offer ${offerId} sent confidentially to ${selectedListing.sellerName}.`
      );
      setSelectedListing(null);
      setOfferForm({ offeredPrice: '', message: '' });
    } catch (err) {
      setOfferFeedback(
        err instanceof Error ? err.message : 'Unable to submit purchase offer.'
      );
    } finally {
      setOfferSubmitting(false);
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
      {offerFeedback && (
        <div className="mb-6 p-3.5 text-sm text-teal-900 bg-teal-50 border border-teal-200 rounded-xl flex items-center justify-between gap-4">
          <span>{offerFeedback}</span>
          <button
            type="button"
            onClick={() => setOfferFeedback(null)}
            className="text-xs font-semibold text-teal-700 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 1: VENDOR OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-navy-950 tracking-tight">
                Vendor Acquisition Portal
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Source pre-owned electronics and appliances directly from RepairLoop
                customers.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('marketplace')}
              className="px-4 py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              Browse Marketplace
            </button>
          </div>

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
                  Available Listings
                </div>
                <div className="text-3xl font-bold font-mono tabular-nums text-navy-950 mt-2">
                  {listings.length}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-xs font-medium text-slate-500">
                  Submitted Offers
                </div>
                <div className="text-3xl font-bold font-mono tabular-nums text-navy-900 mt-2">
                  {myOffers.length}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-xs font-medium text-slate-500">
                  Accepted Offers
                </div>
                <div className="text-3xl font-bold font-mono tabular-nums text-teal-700 mt-2">
                  {acceptedOffers.length}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-xs font-medium text-slate-500">
                  Purchased Products
                </div>
                <div className="text-3xl font-bold font-mono tabular-nums text-emerald-700 mt-2">
                  {purchases.length}
                </div>
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-navy-950 mb-4">
              Recent Purchases &amp; Accepted Bids
            </h2>
            {purchases.length === 0 ? (
              <p className="text-sm text-slate-500">
                No completed purchases yet. Browse available products and submit offers
                to acquire inventory.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {purchases.slice(0, 5).map((p) => (
                  <div
                    key={p.id}
                    className="py-3 flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="text-sm font-semibold text-navy-950">
                        {p.brand} {p.productName} ({p.model})
                      </div>
                      <div className="text-xs text-slate-500">
                        Seller: {p.sellerName} · Order {p.id}
                      </div>
                    </div>
                    <div className="font-mono font-semibold text-teal-700 tabular-nums">
                      ${p.finalPrice.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: AVAILABLE PRODUCTS */}
      {activeTab === 'marketplace' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-navy-950 tracking-tight">
              Resale Marketplace Inventory
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Submit private purchase offers. Competing vendor bids remain strictly
              confidential.
            </p>
          </div>

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

          {filteredListings.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
              No available resale listings match your filter right now.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {filteredListings.map((listing) => {
                const alreadyOffered = myOfferedListingIds.has(listing.id);
                return (
                  <div
                    key={listing.id}
                    className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="font-mono font-semibold text-teal-700">
                              {listing.id}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{listing.condition.replace(/_/g, ' ')}</span>
                            <span aria-hidden="true">·</span>
                            <span>{listing.location}</span>
                          </div>
                          <h3 className="text-base font-semibold text-navy-950 mt-0.5">
                            {listing.brand} {listing.productName} ({listing.model})
                          </h3>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-500">Asking</div>
                          <div className="text-lg font-bold font-mono tabular-nums text-navy-950">
                            ${listing.expectedPrice.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {listing.imageUrl && (
                        <img
                          src={listing.imageUrl}
                          alt={listing.productName}
                          referrerPolicy="no-referrer"
                          className="w-full h-44 object-cover rounded-lg border border-slate-200"
                        />
                      )}

                      <p className="text-sm text-slate-700 leading-relaxed">
                        {listing.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                      <div className="text-xs text-slate-500">
                        Seller: {listing.sellerName} · {listing.ageYears} yrs old
                      </div>
                      {alreadyOffered ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700">
                          <CheckCircle2 className="w-4 h-4" />
                          Offer Submitted
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedListing(listing);
                            setOfferForm({
                              offeredPrice: String(listing.expectedPrice),
                              message: '',
                            });
                          }}
                          className="px-4 py-2 text-xs font-semibold text-white bg-navy-900 hover:bg-navy-800 rounded-lg cursor-pointer whitespace-nowrap"
                        >
                          Make Offer
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

      {/* TAB 3: MY OFFERS */}
      {activeTab === 'my-offers' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-navy-950 tracking-tight">
              My Submitted Offers
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Review all offers you have placed across RepairLoop resale listings.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {myOffers.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                You have not submitted any offers yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4">Offer ID</th>
                      <th className="py-3 px-4">Product</th>
                      <th className="py-3 px-4 text-right">Offered Price</th>
                      <th className="py-3 px-4">Message</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {myOffers.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-teal-700">
                          {o.id}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-navy-950">
                            {o.productName}
                          </div>
                          <div className="text-xs font-mono text-slate-500">
                            {o.listingId}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-navy-950">
                          ${o.offeredPrice.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 max-w-[260px]">
                          {o.message}
                        </td>
                        <td className="py-3 px-4">
                          <StatusText status={o.status} />
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                          {formatTimestamp(o.createdAt)}
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

      {/* TAB 4: PURCHASED PRODUCTS */}
      {activeTab === 'purchased' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-navy-950 tracking-tight">
              Purchased Products
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Confirmed acquisitions where customers accepted your offer.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {purchases.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No completed purchases yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4">Purchase ID</th>
                      <th className="py-3 px-4">Product</th>
                      <th className="py-3 px-4">Model</th>
                      <th className="py-3 px-4">Seller</th>
                      <th className="py-3 px-4 text-right">Final Price</th>
                      <th className="py-3 px-4">Purchased</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {purchases.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-teal-700">
                          {p.id}
                        </td>
                        <td className="py-3 px-4 font-medium text-navy-950">
                          {p.brand} {p.productName}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-600">
                          {p.model}
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {p.sellerName}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700">
                          ${p.finalPrice.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                          {formatTimestamp(p.purchasedAt)}
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

      {/* TAB 5: DECISION ENGINE */}
      {activeTab === 'decision-engine' && <DecisionEngineView userId={user.uid} />}

      {/* SUBMIT OFFER MODAL */}
      {selectedListing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-lg p-6">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="text-xs font-mono font-semibold text-teal-700">
                  {selectedListing.id}
                </div>
                <h2 className="text-lg font-bold text-navy-950">
                  Submit Purchase Offer
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedListing.brand} {selectedListing.productName} · Asking $
                  {selectedListing.expectedPrice.toFixed(2)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedListing(null)}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSubmitOffer} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Offered Price ($)
                </label>
                <input
                  type="number"
                  min={1}
                  step="0.01"
                  required
                  value={offerForm.offeredPrice}
                  onChange={(e) =>
                    setOfferForm((p) => ({ ...p, offeredPrice: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Message to Seller
                </label>
                <textarea
                  required
                  minLength={2}
                  rows={3}
                  value={offerForm.message}
                  onChange={(e) =>
                    setOfferForm((p) => ({ ...p, message: e.target.value }))
                  }
                  placeholder="Include pickup availability, payout method, or inspection terms..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedListing(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={offerSubmitting}
                  className="px-5 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg cursor-pointer disabled:opacity-60"
                >
                  {offerSubmitting ? 'Submitting...' : 'Submit Offer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  );
};
