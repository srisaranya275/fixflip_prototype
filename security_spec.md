# RepairLoop Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Role Immutability & Privilege Separation**: Users may register as `customer`, `mechanic`, or `vendor`, never as an elevated `admin`, and may never mutate `role` or `uid` after profile creation.
2. **PII Isolation**: User documents in `/users/{userId}` contain `email` and are strictly readable only by `request.auth.uid == userId`.
3. **Quotation Confidentiality**: Mechanics can read only their own submitted quotations (`mechanicId == request.auth.uid`). Customers can read quotations targeting their own repair requests (`customerId == request.auth.uid`).
4. **Vendor Offer Confidentiality**: Vendors can read only their own submitted offers (`vendorId == request.auth.uid`). Sellers can read offers targeting their own listings (`sellerId == request.auth.uid`).
5. **Single Quotation Acceptance & Repair Lifecycle**: A repair request can accept at most one quotation (`QUOTATION_ACCEPTED`), and status transitions strictly follow `PENDING -> QUOTATION_RECEIVED -> QUOTATION_ACCEPTED -> REPAIR_IN_PROGRESS -> REPAIR_COMPLETED` (or `CANCELLED` before acceptance). Terminal states (`REPAIR_COMPLETED`, `CANCELLED`) are immutable.
6. **Single Vendor Purchase Atomicity**: A resale listing can accept at most one vendor offer, transitioning to `SOLD` atomically alongside a `/purchases/{purchaseId}` record. Once `SOLD`, no further offers or updates are permitted.
7. **Timestamp & Key Strictness**: Every write enforces `request.time` for `createdAt`/`updatedAt`, strict `hasAll`/`hasOnly` key allowlists, ID regex `^[a-zA-Z0-9_\-]+$`, and `.size()` bounds on all strings.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Privilege Escalation on Profile Create**: `{ "uid": "u1", "fullName": "Mallory", "email": "m@test.com", "role": "admin" }` -> `PERMISSION_DENIED` (invalid role enum).
2. **Role Mutation on Profile Update**: `{ "role": "mechanic", "updatedAt": "serverTimestamp" }` by existing customer -> `PERMISSION_DENIED` (immutable `role`, disallowed `affectedKeys`).
3. **Cross-User PII Read**: `get(/users/otherUid)` -> `PERMISSION_DENIED` (`request.auth.uid != userId`).
4. **Shadow Ghost Field Injection**: `create(/repairRequests/RL-101, { ...validFields, isVerified: true })` -> `PERMISSION_DENIED` (`hasOnly` rejects extra key).
5. **Client Timestamp Forgery**: `create(/repairRequests/RL-101, { ...validFields, createdAt: "2020-01-01T00:00:00Z" })` -> `PERMISSION_DENIED` (`createdAt != request.time`).
6. **ID Poisoning Attack**: `create(/repairRequests/bad$id..1500chars, ...)` -> `PERMISSION_DENIED` (`isValidId` fails).
7. **Competing Mechanic Quotation Spying**: `list(/quotations)` queried by Mechanic B without `where('mechanicId', '==', mechanicB.uid)` -> `PERMISSION_DENIED` (rule evaluates `resource.data.mechanicId == request.auth.uid`).
8. **Customer Creating Quotation for Self**: Mechanic-only `create(/quotations/Q1)` invoked by a `customer` role user -> `PERMISSION_DENIED` (`isMechanic()` fails).
9. **State Shortcutting on Repair Request**: Mechanic updates `status` directly from `PENDING` to `REPAIR_COMPLETED` -> `PERMISSION_DENIED` (action branch rejects skip).
10. **Duplicate Quotation Acceptance**: Customer accepts a second quotation on a request already at `QUOTATION_ACCEPTED` -> `PERMISSION_DENIED` (`existing().status` check fails).
11. **Competing Vendor Offer Spying**: `list(/vendorOffers)` by Vendor B without scoping to `vendorId == vendorB.uid` -> `PERMISSION_DENIED`.
12. **Double Purchase of Sold Listing**: Seller or vendor attempts to update a `resaleListings` doc whose status is already `SOLD` -> `PERMISSION_DENIED` (terminal state lock).
