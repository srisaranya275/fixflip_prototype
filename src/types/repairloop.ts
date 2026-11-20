export type UserRole = 'customer' | 'mechanic' | 'vendor';

export type RepairStatus =
  | 'PENDING'
  | 'QUOTATION_RECEIVED'
  | 'QUOTATION_ACCEPTED'
  | 'REPAIR_IN_PROGRESS'
  | 'REPAIR_COMPLETED'
  | 'CANCELLED';

export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export type ListingStatus = 'AVAILABLE' | 'OFFER_RECEIVED' | 'SOLD';

export type ProductCondition = 'LIKE_NEW' | 'GOOD' | 'FAIR' | 'NEEDS_REPAIR';

export type DecisionRecommendation = 'REPAIR' | 'REPLACE';

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  role: UserRole;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RepairRequest {
  id: string;
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
  status: RepairStatus;
  acceptedQuotationId?: string | null;
  acceptedMechanicId?: string | null;
  acceptedMechanicName?: string | null;
  acceptedCost?: number | null;
  timelineNotes?: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Quotation {
  id: string;
  requestId: string;
  customerId: string;
  productName: string;
  mechanicId: string;
  mechanicName: string;
  estimatedRepairCost: number;
  spareParts: string;
  completionTimeDays: number;
  estimatedAdditionalLifespanMonths: number;
  repairDescription: string;
  notes?: string;
  status: OfferStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NotificationItem {
  id?: string;
  recipientId: string;
  title: string;
  message: string;
  relatedId: string;
  type: 'QUOTATION_ACCEPTED' | 'REPAIR_STATUS' | 'OFFER_ACCEPTED' | 'GENERAL';
  read: boolean;
  createdAt?: unknown;
}

export interface WarrantyRecord {
  id?: string;
  userId: string;
  productName: string;
  brand: string;
  serialOrImei: string;
  purchaseDate: string;
  warrantyDurationMonths: number;
  expiryDate: string;
  purchasePrice: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ResaleListing {
  id: string;
  sellerId: string;
  sellerName: string;
  productName: string;
  category: string;
  brand: string;
  model: string;
  ageYears: number;
  condition: ProductCondition;
  expectedPrice: number;
  location: string;
  description: string;
  imageUrl?: string;
  status: ListingStatus;
  acceptedOfferId?: string | null;
  buyerVendorId?: string | null;
  buyerVendorName?: string | null;
  soldPrice?: number | null;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface VendorOffer {
  id: string;
  listingId: string;
  sellerId: string;
  productName: string;
  vendorId: string;
  vendorName: string;
  offeredPrice: number;
  message: string;
  status: OfferStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PurchaseRecord {
  id: string;
  listingId: string;
  offerId: string;
  sellerId: string;
  sellerName: string;
  vendorId: string;
  vendorName: string;
  productName: string;
  brand: string;
  model: string;
  finalPrice: number;
  purchasedAt?: unknown;
}

export interface DecisionInput {
  productName: string;
  originalPrice: number;
  productAgeYears: number;
  repairCost: number;
  replacementCost: number;
  additionalLifespanMonths: number;
  previousRepairCount: number;
  previousRepairCost: number;
  recurringFault: boolean;
}

export interface DecisionFactorBreakdown {
  costRatioPoints: number;
  productAgePoints: number;
  lifespanGainPoints: number;
  repairHistoryPoints: number;
  faultStabilityPoints: number;
}

export interface DecisionResult {
  repairScore: number;
  replacementScore: number;
  repairCostRatioPercent: number;
  estimatedSavings: number;
  additionalLifespanMonths: number;
  recommendation: DecisionRecommendation;
  explanation: string;
  factorBreakdown: DecisionFactorBreakdown;
  engineSource: 'typescript-mirror' | 'java-http-core';
}

export interface DecisionHistoryRecord extends DecisionInput {
  id?: string;
  userId: string;
  repairScore: number;
  replacementScore: number;
  repairCostRatio: number;
  estimatedSavings: number;
  recommendation: DecisionRecommendation;
  explanation: string;
  engineSource: 'typescript-mirror' | 'java-http-core';
  createdAt?: unknown;
}

export const PRODUCT_CATEGORIES = [
  'Laptops & Computers',
  'Smartphones & Tablets',
  'Kitchen Appliances',
  'Laundry & Dryers',
  'Refrigeration & Cooling',
  'Audio & Home Theater',
  'Air Quality & Climate',
  'Other Electronics',
] as const;

export const FIELD_LIMITS = {
  fullNameMax: 100,
  productNameMax: 120,
  brandMax: 80,
  modelMax: 80,
  descriptionMax: 1500,
  locationMax: 120,
  sparePartsMax: 500,
  notesMax: 500,
  messageMax: 600,
  imageUrlMax: 350000,
} as const;
