/**
 * RepairLoop Firestore Security Rules Test Specification (Dirty Dozen Verification Matrix)
 * Run against Firebase Emulator Suite when testing locally with @firebase/rules-unit-testing.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update';
  expectedOutcome: 'PERMISSION_DENIED';
  payloadSummary: Record<string, unknown>;
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Privilege escalation via admin role on user registration',
    collectionPath: 'users/attackerUid',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    payloadSummary: { uid: 'attackerUid', fullName: 'Attacker', email: 'a@test.com', role: 'admin' },
  },
  {
    id: 2,
    name: 'Self-upgrade role from customer to mechanic on user update',
    collectionPath: 'users/customerUid',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    payloadSummary: { role: 'mechanic' },
  },
  {
    id: 3,
    name: 'Cross-user PII read on users collection',
    collectionPath: 'users/victimUid',
    operation: 'get',
    expectedOutcome: 'PERMISSION_DENIED',
    payloadSummary: {},
  },
  {
    id: 4,
    name: 'Shadow field injection on repair request create',
    collectionPath: 'repairRequests/RL-TEST-1',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    payloadSummary: { id: 'RL-TEST-1', isApprovedByAdmin: true },
  },
  {
    id: 5,
    name: 'Forged client timestamp on warranty create',
    collectionPath: 'warranties/W-TEST-1',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    payloadSummary: { createdAt: '1999-01-01T00:00:00Z' },
  },
  {
    id: 6,
    name: 'Invalid document ID with special characters',
    collectionPath: 'repairRequests/bad$id!@#',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    payloadSummary: { id: 'bad$id!@#' },
  },
  {
    id: 7,
    name: 'Unscoped list query on quotations by non-owner mechanic',
    collectionPath: 'quotations',
    operation: 'list',
    expectedOutcome: 'PERMISSION_DENIED',
    payloadSummary: { query: 'all quotations without mechanicId filter' },
  },
  {
    id: 8,
    name: 'Customer attempting to submit a mechanic quotation',
    collectionPath: 'quotations/Q-SPOOF-1',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    payloadSummary: { mechanicId: 'customerUid', status: 'PENDING' },
  },
  {
    id: 9,
    name: 'Repair status transition jump from PENDING to REPAIR_COMPLETED',
    collectionPath: 'repairRequests/RL-1',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    payloadSummary: { status: 'REPAIR_COMPLETED' },
  },
  {
    id: 10,
    name: 'Duplicate quotation acceptance on already accepted repair request',
    collectionPath: 'quotations/Q-2',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    payloadSummary: { status: 'ACCEPTED' },
  },
  {
    id: 11,
    name: 'Vendor listing all competing vendor offers',
    collectionPath: 'vendorOffers',
    operation: 'list',
    expectedOutcome: 'PERMISSION_DENIED',
    payloadSummary: { query: 'all offers without vendorId filter' },
  },
  {
    id: 12,
    name: 'Updating a resale listing that is already SOLD',
    collectionPath: 'resaleListings/LIST-1',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    payloadSummary: { status: 'AVAILABLE' },
  },
];
