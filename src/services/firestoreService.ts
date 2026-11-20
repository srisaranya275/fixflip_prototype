import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import {
  DecisionHistoryRecord,
  DecisionInput,
  DecisionResult,
  FIELD_LIMITS,
  NotificationItem,
  PurchaseRecord,
  Quotation,
  RepairRequest,
  RepairStatus,
  ResaleListing,
  UserProfile,
  UserRole,
  VendorOffer,
  WarrantyRecord,
} from '../types/repairloop';

export function generateDomainId(prefix: string): string {
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  const timePart = Date.now().toString(36).slice(-4).toUpperCase();
  return `${prefix}-${timePart}${rand}`;
}

export function formatTimestamp(value: unknown): string {
  if (!value) return 'Just now';
  if (value instanceof Timestamp) {
    return value.toDate().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const secs = (value as { seconds: number }).seconds;
    return new Date(secs * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  }
  return 'Recent';
}

function getTimestampMillis(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return ((value as { seconds: number }).seconds || 0) * 1000;
  }
  return 0;
}

function sortByRecent<T extends { createdAt?: unknown; purchasedAt?: unknown }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const tA = getTimestampMillis(a.createdAt ?? a.purchasedAt);
    const tB = getTimestampMillis(b.createdAt ?? b.purchasedAt);
    return tB - tA;
  });
}

export function calculateWarrantyExpiry(purchaseDate: string, durationMonths: number): string {
  const base = new Date(purchaseDate);
  if (Number.isNaN(base.getTime())) return purchaseDate;
  const expiry = new Date(base);
  expiry.setMonth(expiry.getMonth() + Math.max(1, Math.round(durationMonths)));
  return expiry.toISOString().split('T')[0];
}

export type WarrantyStatus = 'ACTIVE' | 'EXPIRING SOON' | 'EXPIRED';

export function getWarrantyStatus(expiryDate: string): {
  status: WarrantyStatus;
  daysRemaining: number;
} {
  const exp = new Date(expiryDate);
  const now = new Date();
  const diffMs = exp.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (daysRemaining < 0) {
    return { status: 'EXPIRED', daysRemaining };
  }
  if (daysRemaining <= 45) {
    return { status: 'EXPIRING SOON', daysRemaining };
  }
  return { status: 'ACTIVE', daysRemaining };
}

export async function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        const maxDim = 640;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.72);
        if (compressed.length > FIELD_LIMITS.imageUrlMax) {
          resolve(canvas.toDataURL('image/jpeg', 0.48).slice(0, FIELD_LIMITS.imageUrlMax));
        } else {
          resolve(compressed);
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

// ------------------------------------------------------------------
// User Profiles
// ------------------------------------------------------------------
export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return snap.data() as UserProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function createUserProfile(
  uid: string,
  fullName: string,
  email: string,
  role: UserRole
): Promise<UserProfile> {
  const path = `users/${uid}`;
  const cleanName = fullName.trim().slice(0, FIELD_LIMITS.fullNameMax) || 'RepairLoop User';
  const cleanEmail = email.trim().slice(0, 150);
  try {
    await setDoc(doc(db, 'users', uid), {
      uid,
      fullName: cleanName.length >= 2 ? cleanName : `${cleanName} User`,
      email: cleanEmail,
      role,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { uid, fullName: cleanName, email: cleanEmail, role };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// ------------------------------------------------------------------
// Repair Requests
// ------------------------------------------------------------------
export interface CreateRepairRequestInput {
  customerId: string;
  customerName: string;
  category: string;
  productName: string;
  brand: string;
  modelNumber: string;
  productAgeYears: number;
  purchaseDate: string;
  originalPrice: number;
  replacementPrice: number;
  previousRepairCount: number;
  previousRepairCost: number;
  recurringFault: boolean;
  problemDescription: string;
  location: string;
  imageUrl?: string;
}

export async function createRepairRequest(input: CreateRepairRequestInput): Promise<string> {
  const id = generateDomainId('RL');
  const path = `repairRequests/${id}`;
  const payload: Record<string, unknown> = {
    id,
    customerId: input.customerId,
    customerName: input.customerName.trim().slice(0, FIELD_LIMITS.fullNameMax),
    category: input.category.trim().slice(0, 60),
    productName: input.productName.trim().slice(0, FIELD_LIMITS.productNameMax),
    brand: input.brand.trim().slice(0, FIELD_LIMITS.brandMax),
    modelNumber: input.modelNumber.trim().slice(0, FIELD_LIMITS.modelMax),
    productAgeYears: Math.max(0, Number(input.productAgeYears) || 0),
    purchaseDate: input.purchaseDate.trim().slice(0, 30),
    originalPrice: Math.max(0, Number(input.originalPrice) || 0),
    replacementPrice: Math.max(0, Number(input.replacementPrice) || 0),
    previousRepairCount: Math.max(0, Math.round(Number(input.previousRepairCount) || 0)),
    previousRepairCost: Math.max(0, Number(input.previousRepairCost) || 0),
    recurringFault: Boolean(input.recurringFault),
    problemDescription: input.problemDescription.trim().slice(0, FIELD_LIMITS.descriptionMax),
    location: input.location.trim().slice(0, FIELD_LIMITS.locationMax),
    status: 'PENDING',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (input.imageUrl && input.imageUrl.trim().length > 0) {
    payload.imageUrl = input.imageUrl.trim().slice(0, FIELD_LIMITS.imageUrlMax);
  }
  try {
    await setDoc(doc(db, 'repairRequests', id), payload);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeCustomerRequests(
  customerId: string,
  onData: (items: RepairRequest[]) => void
) {
  const q = query(collection(db, 'repairRequests'), where('customerId', '==', customerId));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => d.data() as RepairRequest);
      onData(sortByRecent(rows));
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'repairRequests')
  );
}

export function subscribeOpenRequestsForMechanics(onData: (items: RepairRequest[]) => void) {
  const q = query(
    collection(db, 'repairRequests'),
    where('status', 'in', ['PENDING', 'QUOTATION_RECEIVED'])
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => d.data() as RepairRequest);
      onData(sortByRecent(rows));
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'repairRequests')
  );
}

export function subscribeMechanicAssignedRequests(
  mechanicId: string,
  onData: (items: RepairRequest[]) => void
) {
  const q = query(
    collection(db, 'repairRequests'),
    where('acceptedMechanicId', '==', mechanicId)
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => d.data() as RepairRequest);
      onData(sortByRecent(rows));
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'repairRequests')
  );
}

export async function cancelRepairRequest(requestId: string): Promise<void> {
  const path = `repairRequests/${requestId}`;
  try {
    await updateDoc(doc(db, 'repairRequests', requestId), {
      status: 'CANCELLED',
      timelineNotes: 'Cancelled by customer prior to quotation acceptance.',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateRepairProgressByMechanic(
  request: RepairRequest,
  nextStatus: 'REPAIR_IN_PROGRESS' | 'REPAIR_COMPLETED',
  timelineNotes: string
): Promise<void> {
  const path = `repairRequests/${request.id}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'repairRequests', request.id), {
      status: nextStatus,
      timelineNotes: timelineNotes.trim().slice(0, 500) || `Status updated to ${nextStatus}`,
      updatedAt: serverTimestamp(),
    });

    const notifId = generateDomainId('NTF');
    batch.set(doc(db, 'notifications', notifId), {
      recipientId: request.customerId,
      title:
        nextStatus === 'REPAIR_COMPLETED'
          ? `Repair completed for ${request.productName}`
          : `Repair started for ${request.productName}`,
      message: `${request.acceptedMechanicName || 'Your mechanic'} updated ${request.id} to ${nextStatus.replace(/_/g, ' ')}.`,
      relatedId: request.id,
      type: 'REPAIR_STATUS',
      read: false,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ------------------------------------------------------------------
// Quotations
// ------------------------------------------------------------------
export interface SubmitQuotationInput {
  request: RepairRequest;
  mechanicId: string;
  mechanicName: string;
  estimatedRepairCost: number;
  spareParts: string;
  completionTimeDays: number;
  estimatedAdditionalLifespanMonths: number;
  repairDescription: string;
  notes?: string;
}

export async function submitQuotation(input: SubmitQuotationInput): Promise<string> {
  const id = generateDomainId('QT');
  const path = `quotations/${id}`;
  try {
    const batch = writeBatch(db);
    const quotationPayload: Record<string, unknown> = {
      id,
      requestId: input.request.id,
      customerId: input.request.customerId,
      productName: input.request.productName.slice(0, FIELD_LIMITS.productNameMax),
      mechanicId: input.mechanicId,
      mechanicName: input.mechanicName.trim().slice(0, FIELD_LIMITS.fullNameMax),
      estimatedRepairCost: Math.max(1, Number(input.estimatedRepairCost)),
      spareParts: input.spareParts.trim().slice(0, FIELD_LIMITS.sparePartsMax),
      completionTimeDays: Math.max(1, Math.round(Number(input.completionTimeDays))),
      estimatedAdditionalLifespanMonths: Math.max(
        1,
        Math.round(Number(input.estimatedAdditionalLifespanMonths))
      ),
      repairDescription: input.repairDescription.trim().slice(0, 1000),
      status: 'PENDING',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (input.notes && input.notes.trim().length > 0) {
      quotationPayload.notes = input.notes.trim().slice(0, FIELD_LIMITS.notesMax);
    }

    batch.set(doc(db, 'quotations', id), quotationPayload);

    if (input.request.status === 'PENDING') {
      batch.update(doc(db, 'repairRequests', input.request.id), {
        status: 'QUOTATION_RECEIVED',
        updatedAt: serverTimestamp(),
      });
    }

    const notifId = generateDomainId('NTF');
    batch.set(doc(db, 'notifications', notifId), {
      recipientId: input.request.customerId,
      title: `New quotation for ${input.request.productName}`,
      message: `${input.mechanicName} quoted $${Number(input.estimatedRepairCost).toFixed(2)} (${input.completionTimeDays} days).`,
      relatedId: input.request.id,
      type: 'GENERAL',
      read: false,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeCustomerQuotations(
  customerId: string,
  onData: (items: Quotation[]) => void
) {
  const q = query(collection(db, 'quotations'), where('customerId', '==', customerId));
  return onSnapshot(
    q,
    (snap) => onData(sortByRecent(snap.docs.map((d) => d.data() as Quotation))),
    (error) => handleFirestoreError(error, OperationType.LIST, 'quotations')
  );
}

export function subscribeMechanicQuotations(
  mechanicId: string,
  onData: (items: Quotation[]) => void
) {
  const q = query(collection(db, 'quotations'), where('mechanicId', '==', mechanicId));
  return onSnapshot(
    q,
    (snap) => onData(sortByRecent(snap.docs.map((d) => d.data() as Quotation))),
    (error) => handleFirestoreError(error, OperationType.LIST, 'quotations')
  );
}

export async function acceptQuotationAtomic(
  request: RepairRequest,
  selectedQuotation: Quotation,
  allQuotationsForRequest: Quotation[]
): Promise<void> {
  if (
    request.status !== 'PENDING' &&
    request.status !== 'QUOTATION_RECEIVED'
  ) {
    throw new Error('A quotation has already been accepted or the request is closed.');
  }
  const path = `repairRequests/${request.id}`;
  try {
    const batch = writeBatch(db);

    batch.update(doc(db, 'repairRequests', request.id), {
      status: 'QUOTATION_ACCEPTED' as RepairStatus,
      acceptedQuotationId: selectedQuotation.id,
      acceptedMechanicId: selectedQuotation.mechanicId,
      acceptedMechanicName: selectedQuotation.mechanicName,
      acceptedCost: selectedQuotation.estimatedRepairCost,
      timelineNotes: `Selected ${selectedQuotation.mechanicName} ($${selectedQuotation.estimatedRepairCost.toFixed(2)}).`,
      updatedAt: serverTimestamp(),
    });

    for (const q of allQuotationsForRequest) {
      if (q.status !== 'PENDING') continue;
      batch.update(doc(db, 'quotations', q.id), {
        status: q.id === selectedQuotation.id ? 'ACCEPTED' : 'REJECTED',
        updatedAt: serverTimestamp(),
      });
    }

    const notifId = generateDomainId('NTF');
    batch.set(doc(db, 'notifications', notifId), {
      recipientId: selectedQuotation.mechanicId,
      title: `Quotation accepted: ${request.productName}`,
      message: `${request.customerName} accepted your quotation (${selectedQuotation.id}) for $${selectedQuotation.estimatedRepairCost.toFixed(2)}.`,
      relatedId: request.id,
      type: 'QUOTATION_ACCEPTED',
      read: false,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function rejectSingleQuotation(quotation: Quotation): Promise<void> {
  const path = `quotations/${quotation.id}`;
  try {
    await updateDoc(doc(db, 'quotations', quotation.id), {
      status: 'REJECTED',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ------------------------------------------------------------------
// Notifications
// ------------------------------------------------------------------
export function subscribeUserNotifications(
  userId: string,
  onData: (items: NotificationItem[]) => void
) {
  const q = query(collection(db, 'notifications'), where('recipientId', '==', userId));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<NotificationItem, 'id'>),
      }));
      onData(sortByRecent(rows));
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'notifications')
  );
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const path = `notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ------------------------------------------------------------------
// Warranty Register
// ------------------------------------------------------------------
export async function createWarrantyRecord(
  userId: string,
  data: {
    productName: string;
    brand: string;
    serialOrImei: string;
    purchaseDate: string;
    warrantyDurationMonths: number;
    purchasePrice: number;
  }
): Promise<string> {
  const id = generateDomainId('WR');
  const path = `warranties/${id}`;
  const expiryDate = calculateWarrantyExpiry(data.purchaseDate, data.warrantyDurationMonths);
  try {
    await setDoc(doc(db, 'warranties', id), {
      userId,
      productName: data.productName.trim().slice(0, FIELD_LIMITS.productNameMax),
      brand: data.brand.trim().slice(0, FIELD_LIMITS.brandMax),
      serialOrImei: data.serialOrImei.trim().slice(0, 100),
      purchaseDate: data.purchaseDate.trim().slice(0, 30),
      warrantyDurationMonths: Math.max(1, Math.round(data.warrantyDurationMonths)),
      expiryDate,
      purchasePrice: Math.max(0, Number(data.purchasePrice)),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteWarrantyRecord(warrantyId: string): Promise<void> {
  const path = `warranties/${warrantyId}`;
  try {
    await deleteDoc(doc(db, 'warranties', warrantyId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeUserWarranties(
  userId: string,
  onData: (items: WarrantyRecord[]) => void
) {
  const q = query(collection(db, 'warranties'), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<WarrantyRecord, 'id'>),
      }));
      onData(sortByRecent(rows));
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'warranties')
  );
}

// ------------------------------------------------------------------
// Resale Marketplace & Vendor Offers
// ------------------------------------------------------------------
export interface CreateResaleListingInput {
  sellerId: string;
  sellerName: string;
  productName: string;
  category: string;
  brand: string;
  model: string;
  ageYears: number;
  condition: ResaleListing['condition'];
  expectedPrice: number;
  location: string;
  description: string;
  imageUrl?: string;
}

export async function createResaleListing(input: CreateResaleListingInput): Promise<string> {
  const id = generateDomainId('LIST');
  const path = `resaleListings/${id}`;
  const payload: Record<string, unknown> = {
    id,
    sellerId: input.sellerId,
    sellerName: input.sellerName.trim().slice(0, FIELD_LIMITS.fullNameMax),
    productName: input.productName.trim().slice(0, FIELD_LIMITS.productNameMax),
    category: input.category.trim().slice(0, 60),
    brand: input.brand.trim().slice(0, FIELD_LIMITS.brandMax),
    model: input.model.trim().slice(0, FIELD_LIMITS.modelMax),
    ageYears: Math.max(0, Number(input.ageYears) || 0),
    condition: input.condition,
    expectedPrice: Math.max(1, Number(input.expectedPrice)),
    location: input.location.trim().slice(0, FIELD_LIMITS.locationMax),
    description: input.description.trim().slice(0, FIELD_LIMITS.descriptionMax),
    status: 'AVAILABLE',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (input.imageUrl && input.imageUrl.trim().length > 0) {
    payload.imageUrl = input.imageUrl.trim().slice(0, FIELD_LIMITS.imageUrlMax);
  }
  try {
    await setDoc(doc(db, 'resaleListings', id), payload);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteResaleListing(listingId: string): Promise<void> {
  const path = `resaleListings/${listingId}`;
  try {
    await deleteDoc(doc(db, 'resaleListings', listingId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeCustomerListings(
  sellerId: string,
  onData: (items: ResaleListing[]) => void
) {
  const q = query(collection(db, 'resaleListings'), where('sellerId', '==', sellerId));
  return onSnapshot(
    q,
    (snap) => onData(sortByRecent(snap.docs.map((d) => d.data() as ResaleListing))),
    (error) => handleFirestoreError(error, OperationType.LIST, 'resaleListings')
  );
}

export function subscribeAvailableListingsForVendors(
  onData: (items: ResaleListing[]) => void
) {
  const q = query(
    collection(db, 'resaleListings'),
    where('status', 'in', ['AVAILABLE', 'OFFER_RECEIVED'])
  );
  return onSnapshot(
    q,
    (snap) => onData(sortByRecent(snap.docs.map((d) => d.data() as ResaleListing))),
    (error) => handleFirestoreError(error, OperationType.LIST, 'resaleListings')
  );
}

export async function submitVendorOffer(input: {
  listing: ResaleListing;
  vendorId: string;
  vendorName: string;
  offeredPrice: number;
  message: string;
}): Promise<string> {
  const id = generateDomainId('OFF');
  const path = `vendorOffers/${id}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'vendorOffers', id), {
      id,
      listingId: input.listing.id,
      sellerId: input.listing.sellerId,
      productName: input.listing.productName.slice(0, FIELD_LIMITS.productNameMax),
      vendorId: input.vendorId,
      vendorName: input.vendorName.trim().slice(0, FIELD_LIMITS.fullNameMax),
      offeredPrice: Math.max(1, Number(input.offeredPrice)),
      message: input.message.trim().slice(0, FIELD_LIMITS.messageMax),
      status: 'PENDING',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (input.listing.status === 'AVAILABLE') {
      batch.update(doc(db, 'resaleListings', input.listing.id), {
        status: 'OFFER_RECEIVED',
        updatedAt: serverTimestamp(),
      });
    }

    const notifId = generateDomainId('NTF');
    batch.set(doc(db, 'notifications', notifId), {
      recipientId: input.listing.sellerId,
      title: `New offer on ${input.listing.productName}`,
      message: `${input.vendorName} offered $${Number(input.offeredPrice).toFixed(2)}.`,
      relatedId: input.listing.id,
      type: 'GENERAL',
      read: false,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeSellerOffers(
  sellerId: string,
  onData: (items: VendorOffer[]) => void
) {
  const q = query(collection(db, 'vendorOffers'), where('sellerId', '==', sellerId));
  return onSnapshot(
    q,
    (snap) => onData(sortByRecent(snap.docs.map((d) => d.data() as VendorOffer))),
    (error) => handleFirestoreError(error, OperationType.LIST, 'vendorOffers')
  );
}

export function subscribeVendorOffers(
  vendorId: string,
  onData: (items: VendorOffer[]) => void
) {
  const q = query(collection(db, 'vendorOffers'), where('vendorId', '==', vendorId));
  return onSnapshot(
    q,
    (snap) => onData(sortByRecent(snap.docs.map((d) => d.data() as VendorOffer))),
    (error) => handleFirestoreError(error, OperationType.LIST, 'vendorOffers')
  );
}

export async function acceptVendorOfferAtomic(
  listing: ResaleListing,
  selectedOffer: VendorOffer,
  allOffersForListing: VendorOffer[]
): Promise<string> {
  if (listing.status === 'SOLD') {
    throw new Error('This product has already been sold to a vendor.');
  }
  const purchaseId = generateDomainId('PUR');
  const path = `resaleListings/${listing.id}`;
  try {
    const batch = writeBatch(db);

    batch.update(doc(db, 'resaleListings', listing.id), {
      status: 'SOLD',
      acceptedOfferId: selectedOffer.id,
      buyerVendorId: selectedOffer.vendorId,
      buyerVendorName: selectedOffer.vendorName,
      soldPrice: selectedOffer.offeredPrice,
      updatedAt: serverTimestamp(),
    });

    for (const offer of allOffersForListing) {
      if (offer.status !== 'PENDING') continue;
      batch.update(doc(db, 'vendorOffers', offer.id), {
        status: offer.id === selectedOffer.id ? 'ACCEPTED' : 'REJECTED',
        updatedAt: serverTimestamp(),
      });
    }

    batch.set(doc(db, 'purchases', purchaseId), {
      id: purchaseId,
      listingId: listing.id,
      offerId: selectedOffer.id,
      sellerId: listing.sellerId,
      sellerName: listing.sellerName,
      vendorId: selectedOffer.vendorId,
      vendorName: selectedOffer.vendorName,
      productName: listing.productName,
      brand: listing.brand,
      model: listing.model,
      finalPrice: selectedOffer.offeredPrice,
      purchasedAt: serverTimestamp(),
    });

    const notifId = generateDomainId('NTF');
    batch.set(doc(db, 'notifications', notifId), {
      recipientId: selectedOffer.vendorId,
      title: `Offer accepted: ${listing.productName}`,
      message: `${listing.sellerName} accepted your $${selectedOffer.offeredPrice.toFixed(2)} offer. Purchase order ${purchaseId} created.`,
      relatedId: purchaseId,
      type: 'OFFER_ACCEPTED',
      read: false,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
    return purchaseId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function rejectSingleVendorOffer(offer: VendorOffer): Promise<void> {
  const path = `vendorOffers/${offer.id}`;
  try {
    await updateDoc(doc(db, 'vendorOffers', offer.id), {
      status: 'REJECTED',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeVendorPurchases(
  vendorId: string,
  onData: (items: PurchaseRecord[]) => void
) {
  const q = query(collection(db, 'purchases'), where('vendorId', '==', vendorId));
  return onSnapshot(
    q,
    (snap) => onData(sortByRecent(snap.docs.map((d) => d.data() as PurchaseRecord))),
    (error) => handleFirestoreError(error, OperationType.LIST, 'purchases')
  );
}

export function subscribeSellerPurchases(
  sellerId: string,
  onData: (items: PurchaseRecord[]) => void
) {
  const q = query(collection(db, 'purchases'), where('sellerId', '==', sellerId));
  return onSnapshot(
    q,
    (snap) => onData(sortByRecent(snap.docs.map((d) => d.data() as PurchaseRecord))),
    (error) => handleFirestoreError(error, OperationType.LIST, 'purchases')
  );
}

// ------------------------------------------------------------------
// Decision Engine History
// ------------------------------------------------------------------
export async function saveDecisionAnalysis(
  userId: string,
  input: DecisionInput,
  result: DecisionResult
): Promise<string> {
  const id = generateDomainId('DEC');
  const path = `decisionHistory/${id}`;
  try {
    await setDoc(doc(db, 'decisionHistory', id), {
      userId,
      productName: input.productName.trim().slice(0, FIELD_LIMITS.productNameMax) || 'Evaluated Device',
      originalPrice: Number(input.originalPrice),
      productAgeYears: Number(input.productAgeYears),
      repairCost: Number(input.repairCost),
      replacementCost: Number(input.replacementCost),
      additionalLifespanMonths: Number(input.additionalLifespanMonths),
      previousRepairCount: Number(input.previousRepairCount),
      previousRepairCost: Number(input.previousRepairCost),
      recurringFault: Boolean(input.recurringFault),
      repairScore: result.repairScore,
      replacementScore: result.replacementScore,
      repairCostRatio: result.repairCostRatioPercent,
      estimatedSavings: result.estimatedSavings,
      recommendation: result.recommendation,
      explanation: result.explanation.slice(0, 1000),
      engineSource: result.engineSource,
      createdAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeDecisionHistory(
  userId: string,
  onData: (items: DecisionHistoryRecord[]) => void
) {
  const q = query(collection(db, 'decisionHistory'), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<DecisionHistoryRecord, 'id'>),
      }));
      onData(sortByRecent(rows));
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'decisionHistory')
  );
}
