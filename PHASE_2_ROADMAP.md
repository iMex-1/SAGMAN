# Phase 2 — Core Operations Roadmap

## Status: Ready to Begin

All critical bugs have been fixed. The backend API is fully implemented and ready for frontend UI development.

---

## Phase 2 Objectives

Complete the core repair workflow from car assignment → appointment → repair creation → state machine → completion.

---

## Implementation Tasks

### 1. Car Management (CRUD + History)

**Backend:** ✅ Already implemented (`/api/v1/cars`)

**Frontend UI:**
- `apps/web/src/app/(internal)/cars/new/page.tsx` — Create car form
- `apps/web/src/app/(internal)/cars/[id]/page.tsx` — Car detail page
- `apps/web/src/app/(internal)/cars/page.tsx` — Car list with search

**Tasks:**
- [ ] Verify car create form fields match API schema
- [ ] Verify car detail page shows repair history
- [ ] Verify car list shows matricule, make, model, client
- [ ] Test soft delete functionality

**Notes:**
- Car soft delete uses `deletedAt` field
- Car can be linked to a client
- Car can have multiple repairs

---

### 2. Appointment Management

**Backend:** ✅ Already implemented (`/api/v1/appointments`)

**Frontend UI:**
- `apps/web/src/app/(internal)/appointments/new/page.tsx` — Book appointment
- `apps/web/src/app/(internal)/appointments/[id]/page.tsx` — Appointment detail
- `apps/web/src/app/(internal)/appointments/page.tsx` — Appointment list

**Appointment States:**
- `pending` → `confirmed` / `rescheduled` / `cancelled` / `converted` → repair
- Client portal supports: book appointment, view own appointments

**Tasks:**
- [ ] Create appointment form: car selector, client name, purpose, date/time
- [ ] Appointment detail: show status badges, confirm/reschedule/cancel buttons
- [ ] Appointment list: filter by status, search by car/matricule/client name
- [ ] "Convert to Repair" button for confirmed appointments

**Notes:**
- Confirmed appointments have `confirmedAt` timestamp
- Rescheduling: `rescheduledTo` field, status becomes `rescheduled`
- Cancelled: requires `cancellationReason`
- Converted: creates a repair job from the appointment

---

### 3. Repair Job Creation

**Backend:** ✅ Already implemented (`/api/v1/repairs`)

**Frontend UI:**
- `apps/web/src/app/(internal)/repairs/new/page.tsx` — Create repair from appointment or car

**Tasks:**
- [ ] Repair creation form:
  - Select appointment (optional)
  - Select car (required)
  - Select primary mechanic (required)
  - Select secondary mechanics (optional)
  - Set priority
  - Set target completion date
  - Set estimated duration
  - Add description and internal notes

**Business Rules Enforced by Backend:**
- BR-008: Car must have no active repair
- BR-010: Last manager cannot be deactivated (in employees)
- Mechanic assignment requires at least one mechanic
- State transitions enforced by `ALLOWED_TRANSITIONS`

---

### 4. Repair State Machine UI

**Backend:** ✅ Complete (state machine in `repair.service.ts`)

**Repair States:**
```
received → diagnosing → awaiting_approval → in_progress → complete → delivered
                                    ↓              ↓
                                cancelled    waiting_for_parts
```

**Frontend UI (Already in `repairs/[id]/page.tsx`):**
- Status tabs: received, diagnosing, awaiting_approval, in_progress, complete
- Status transition buttons per current state
- Overdue banner with delay report
- Reopen button (manager only)

**Tasks:**
- [ ] Status transition confirmation dialogs
- [ ] Overdue banner with delay report submission
- [ ] Reopen dialog for completed repairs

**Notes:**
- Mechanic can only update assigned repairs
- Delivered requires payment
- Complete → in_progress (rework) requires manager + reopenedReason

---

### 5. Mechanic Assignment & Work Logging

**Backend:** ✅ Complete

**Endpoints:**
- `PATCH /repairs/:id/assign` — Reassign mechanics
- `POST /repairs/:id/work-logs` — Log work hours
- `GET /repairs/:id/work-logs` — List work logs

**Frontend UI (Already in `repairs/[id]/page.tsx`):**
- MechanicsCard component with reassign dialog
- Work logs section with add button

**Tasks:**
- [ ] Verify mechanic assignment works end-to-end
- [ ] Verify work log logging works
- [ ] Add work log summary totals

---

### 6. Diagnosis Workflow

**Backend:** ✅ Complete

**Endpoints:**
- `POST /repairs/:id/diagnosis` — Save diagnosis report
- `PATCH /repairs/:id/share-diagnosis` — Share with client
- `PATCH //:id/client-approval` — Record approval (approved/rejected/bypassed)

**Diagnosis Report Schema (Zod):**
```typescript
z.object({
  issues: z.array(z.object({
    description: z.string(),
    severity: z.enum(['Minor', 'Moderate', 'Critical']),
  })),
  recommendedRepairs: z.string(),
  estimatedDurationHours: z.number().optional(),
  additionalNotes: z.string().optional(),
})
```

**Tasks:**
- [ ] Diagnosis form with issues list (add/remove severity)
- [ ] Recommended repairs textarea
- [ ] Estimated duration input
- [ ] "Share Diagnosis" button → changes status to `awaiting_approval`
- [ ] Client approval panel: approved/rejected/bypassed buttons
- [ ] Bypass reason input when bypassing approval

---

### 7. Parts Assignment to Repairs

**Backend:** ✅ Complete

**Endpoints:**
- `POST /repairs/:id/parts` — Add part to repair
- `DELETE /repairs/:id/parts/:repairPartId` — Remove part
- `GET /repairs/:id/parts` — List parts (included in repair detail)

**Frontend UI (Already in `repairs/[id]/page.tsx`):**
- Parts tab with "Add Part" button
- Part selection with quantity
- Stock override option

**Tasks:**
- [ ] Part search/autocomplete by name/reference
- [ ] Quantity input with min/max validation
- [ ] Stock override toggle
- [ ] Part list with unit cost, quantity used, total
- [ ] "Remove part" button for each line item

**Notes:**
- Part cost is frozen at assignment time (`unitCostAtTime`)
- Stock decrement is atomic
- Insufficient stock requires `stockOverride: true`

---

### 8. Labor Items

**Backend:** ✅ Complete

**Endpoints:**
- `POST /repairs/:id/labor-items` — Add labor item
- `DELETE /repairs/:id/labor-items/:laborId` — Remove labor item

**Frontend UI:**
- Labor tab with "Add Labor" button

**Tasks:**
- [ ] Labor form: description, cost
- [ ] Labor list with remove button
- [ ] Auto-recalculate totals when items change

---

### 9. Payment Registration

**Backend:** ✅ Complete

**Endpoints:**
- `POST /payments` — Register payment for repair
- `GET /repairs/:id/payment` — Get payment (included in repair detail)

**Payment Schema:**
```typescript
{
  repairId: string,
  amountBilled: number,
  partsTotal: number,
  laborTotal: number,
  discountAmount: number,
  finalTotal: number,
  amountReceived: number,
  changeDue: number,
  method: "cash" | "card" | "transfer",
  paidByName?: string,
  invoiceNumber: string, // Auto-generated
  notes?: string
}
```

**Tasks:**
- [ ] Payment form:
  - Show repair totals (parts, labor, discount)
  - Amount received input
  - Change due display
  - Payment method selector
  - Paid by name (optional)
  - Notes (optional)
- [ ] "Register Payment" button
- [ ] Invoice generation (atomic sequential numbering)
- [ ] Mark as delivered button (requires payment)

---

### 10. WhatsApp Notification Triggers

**Backend:** ✅ Complete (`whatsapp.service.ts`)

**Templates:**
- T-01: Appointment confirmation
- T-02: Appointment rescheduled
- T-03: Diagnosis results
- T-04: Car ready
- T-05: Invoice

**Frontend UI:**
- Add "Send WhatsApp" buttons on:
  - Appointment confirmation page
  - Repair detail page (status changes)
  - Payment registration page

**Tasks:**
- [ ] Add WhatsApp buttons to appointment list/detail
- [ ] Add WhatsApp buttons to repair detail
- [ ] Open wa.me URL in new tab (no API integration)
- [ ] Log WhatsApp sent event in `notification_logs` table

---

## Implementation Order

1. **Car CRUD UI** (2-3 hours) — Foundation for appointments/repairs
2. **Appointment UI** (3-4 hours) — Books cars to mechanics
3. **Repair Create + State Machine** (4-5 hours) — Core workflow
4. **Diagnosis Workflow** (3-4 hours) — Client approval
5. **Parts & Labor** (3 hours) — Cost tracking
6. **Payment Registration** (2 hours) — Financial close
7. **WhatsApp Triggers** (1 hour) — Client notifications

**Total Estimate:** ~20-25 hours

---

## Dependencies

- Phase 2 requires Phase 1 to be complete (✅ Done)
- All API endpoints are implemented (✅ Done)
- No new backend work needed for Phase 2
