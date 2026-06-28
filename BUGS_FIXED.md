# SAGMAN Bug Fixes Summary

## Fixed Bugs

### 1. Root Page Redirect
**File:** `apps/web/src/app/page.tsx`
**Issue:** Root `/` redirected to `/dashboard` instead of client portal
**Fix:** Changed redirect to `/portal`
**Impact:** Users now land on client portal by default

### 2. MechanicsCard API Endpoint
**File:** `apps/web/src/app/(internal)/repairs/[id]/page.tsx`
**Issue:** Mechanic reassignment called `PATCH /repairs/:id` with wrong parameters
**Fix:** Changed to `PATCH /repairs/:id/assign` with correct parameters:
- `primaryMechanicId` (string)
- `secondaryMechanicIds` (string[])
**Impact:** Mechanic reassignment now works correctly

### 3. Notifications Page sentBy Key Mismatch
**File:** `apps/web/src/app/(internal)/notifications/page.tsx`
**Issue:** Frontend expected `user.name` but API returns `sentBy.name`
**Fix:** Changed interface from `user: { name }` to `sentBy: { name }`
**Impact:** "Sent by" column now displays correctly

### 4. Settings Page - camelCase vs snake_case
**File:** `apps/web/web/src/app/(internal)/settings/page.tsx`
**Issue:** Frontend used camelCase keys but API expects snake_case
**Fix:** Rewrote settings page to use snake_case keys matching API schema:
- `garage_name` (was `garageName`)
- `garage_address` (was `garageAddress`)
- `garage_phone` (was `garagePhone`)
- `max_concurrent_cars` (was `maxConcurrentCars`)
- `working_hours` (was `workingHours`)
- `currency_label` (was `currency`)
- `overseer_whatsapp_number` (was `overseerWhatsapp`)
- `require_diagnosis_approval` (was `requireDiagnosisApproval`)
- `require_client_approval` (was `requireClientApproval`)
- `session_timeout_hours` (was `sessionTimeoutMinutes`)

Also updated:
- Default values to match schema
- Input field IDs to snake_case
- `useToast()` destructuring was correct (returns `success`, `error`, `info`)

**Impact:** Settings save now works correctly

### 5. Repairs List isOverdue Filter
**File:** `apps/api/src/routes/v1/repairs/index.ts`
**Issue:** `isOverdue` query param was passed but not supported
**Fix:** Added `isOverdue?: string` to query type and implemented filter:
```typescript
const overdueFilter =
  query.isOverdue === 'true'
    ? {
        targetCompletionDate: { lt: new Date() },
        status: { notIn: ['complete', 'delivered', 'cancelled'] as any[] },
      }
    : {}
```
**Impact:** "Overdue" tab in repairs list now filters correctly

### 6. Stock Transactions Repair Data
**File:** `apps/api/src/routes/v1/parts/index.ts`
**Issue:** `GET /parts/:id/transactions` didn't include repair data
**Fix:** Added `repair` include clause:
```typescript
include: {
  doneBy: { select: { id: true, name: true } },
  repair: { select: { id: true, status: true } },
}
```
**Impact:** Stock transaction history now shows repair links

## Summary

| Bug | Severity | Status |
|-----|----------|--------|
| Root page redirect | High | ✅ Fixed |
| MechanicsCard API | High | ✅ Fixed |
| Notifications sentBy | High | ✅ Fixed |
| Settings snake_case | High | ✅ Fixed |
| isOverdue filter | High | ✅ Fixed |
| Stock repair data | Medium | ✅ Fixed |

All critical bugs have been addressed. Phase 2 implementation (core operations) is ready to proceed.
