# Phase 3 — Inventory & Financials Implementation Roadmap

## Status: IN PROGRESS

**Goal:** Complete stock/parts management and payment/invoicing workflows.

**Duration:** Weeks 7–8 (estimated 20-25 hours)

**Phase 2 Dependencies:** ✅ All Phase 2 components complete and tested

---

## Phase 3 Objectives

1. **Parts Catalog & Stock Management**
   - CRUD for parts with soft delete
   - Stock transactions (received/used/adjustment)
   - Low-stock alerts

2. **Parts Assignment to Repairs**
   - Assign parts from stock to repairs
   - Automatic stock decrement & cost snapshot
   - Stock override with logging

3. **Labor Items**
   - Add/edit/remove labor items per repair
   - Auto-recalculate labor totals

4. **Payment & Invoicing**
   - Register payment for completed repairs
   - Auto-generate sequential invoice numbers
   - Invoice preview & printable

---

## Implementation Tasks

### Task 1: Stock & Parts Management (API)
**Estimated:** 3-4 hours

- [ ] `POST /api/v1/parts` — Create part
- [ ] `GET /api/v1/parts` — List parts (with low-stock filter)
- [ ] `GET /api/v1/parts/:id` — Part detail
- [ ] `PATCH /api/v1/parts/:id` — Update part
- [ ] `DELETE /api/v1/parts/:id` — Soft delete
- [ ] `POST /api/v1/parts/:id/stock` — Add received stock
- [ ] `POST /api/v1/parts/:id/adjust` — Manual adjustment
- [ ] `GET /api/v1/parts/:id/transactions` — Transaction history
- [ ] Service: stock transaction logging with type (received/used/adjustment)
- [ ] Service: low-stock detection query
- [ ] Validation: part name & reference uniqueness

**Files to create/modify:**
- `apps/api/src/routes/v1/parts/index.ts` — Already exists, enhance
- `apps/api/src/services/stock.service.ts` — New service

---

### Task 2: Stock & Parts UI (Frontend)
**Estimated:** 3-4 hours

- [ ] `/stock/page.tsx` — Enhanced with transaction history
- [ ] `/stock/new/page.tsx` — Part creation form
- [ ] `/stock/[id]/page.tsx` — Part detail + stock transactions table
- [ ] Low-stock banner on dashboard
- [ ] Stock transaction modals (Add Stock, Adjust)
- [ ] Search/filter by category

**Files to create/modify:**
- `apps/web/src/app/(internal)/stock/page.tsx` — Enhanced
- `apps/web/src/app/(internal)/stock/new/page.tsx` — New
- `apps/web/src/app/(internal)/stock/[id]/page.tsx` — New
- `apps/web/src/components/stock/` — Stock-specific components

---

### Task 3: Parts Assignment & Labor (API)
**Estimated:** 3-4 hours

- [ ] `POST /api/v1/repairs/:id/parts` — Assign part to repair
  - Validate stock > 0 OR manager override
  - Decrement stock atomically
  - Create RepairPart with unit_cost_at_time
  - Create StockTransaction (type=used)
  - Recalculate parts_total & final_total
- [ ] `DELETE /api/v1/repairs/:id/parts/:repairPartId` — Remove part & restore stock
- [ ] `POST /api/v1/repairs/:id/labor` — Add labor item
- [ ] `PATCH /api/v1/repairs/:id/labor/:itemId` — Update labor item
- [ ] `DELETE /api/v1/repairs/:id/labor/:itemId` — Remove labor item
- [ ] Auto-recalculate labor_total on all changes
- [ ] Validation: prevent duplicate part assignments

**Files to create/modify:**
- `apps/api/src/routes/v1/repairs/index.ts` — Add endpoints
- `apps/api/src/services/stock.service.ts` — Stock decrement logic

---

### Task 4: Parts Assignment & Labor UI (Frontend)
**Estimated:** 2-3 hours

- [ ] PartsPanel enhancements in `/repairs/[id]/page.tsx`:
  - Part search with autocomplete
  - Quantity input with min/max
  - Stock level inline display
  - Override warning for zero-stock
  - Parts cost at time display
- [ ] LaborPanel enhancements:
  - Add labor modal
  - Inline edit/delete
  - Auto-total recalculation
- [ ] Both panels update repair totals in real-time

**Files to create/modify:**
- `apps/web/src/app/(internal)/repairs/[id]/page.tsx` — Enhance PartsPanel & LaborPanel

---

### Task 5: Invoicing Service & API (API)
**Estimated:** 2-3 hours

- [ ] Invoice counter service: atomic increment with `InvoiceCounter` table
- [ ] Invoice number format: `INV-YYYY-XXXXX` (zero-padded 5 digits)
- [ ] `POST /api/v1/payments` — Register payment:
  - Validate repair status = complete
  - Calculate change_due
  - Generate invoice number
  - Create Payment record (immutable)
- [ ] `GET /api/v1/repairs/:id/invoice` — Return invoice data for display/print
- [ ] Validation: payment can only be registered once per repair

**Files to create/modify:**
- `apps/api/src/routes/v1/payments/index.ts` — Already exists, enhance
- `apps/api/src/services/invoice.service.ts` — Already exists, verify/enhance
- `apps/api/src/routes/v1/repairs/index.ts` — Add `/repairs/:id/invoice` endpoint

---

### Task 6: Payment & Invoice UI (Frontend)
**Estimated:** 2-3 hours

- [ ] Payment form panel on repair detail (visible when status = Complete):
  - Amount billed (auto-calculated, editable)
  - Amount received input
  - Change due display
  - Payment method (cash default)
  - Paid by name (optional)
  - Notes (optional)
  - Register Payment button
- [ ] Invoice preview page: `/repairs/[id]/invoice`
  - Garage info (name, address, phone from settings)
  - Client & car details
  - Parts itemized
  - Labor itemized
  - Totals & change
  - Printable (CSS media queries for print)
  - Mechanic names
  - Manager name
- [ ] Invoice share via WhatsApp (T-05)

**Files to create/modify:**
- `apps/web/src/app/(internal)/repairs/[id]/page.tsx` — Add PaymentPanel
- `apps/web/src/app/(internal)/repairs/[id]/invoice/page.tsx` — Invoice detail page
- `apps/web/src/components/payment/` — Payment components

---

### Task 7: Stock & Inventory Testing
**Estimated:** 2-3 hours

- [ ] End-to-end test: create part → add stock → assign to repair → verify decrement
- [ ] Stock override scenario: zero-stock part with manager override
- [ ] Manual adjustment with note logging
- [ ] Transaction history audit trail
- [ ] Low-stock alert on dashboard

---

### Task 8: Payment & Invoice Testing
**Estimated:** 2-3 hours

- [ ] Payment workflow: complete repair → register payment → invoice generated
- [ ] Invoice number sequencing (INV-2026-00001, INV-2026-00002, etc.)
- [ ] Invoice immutability after creation
- [ ] Print/PDF rendering test
- [ ] WhatsApp T-05 link generation test

---

## Acceptance Criteria

### Parts & Stock
- ✅ Part can be created with name, reference, category, cost, min threshold
- ✅ Stock can be added (received) with transaction logged
- ✅ Stock can be manually adjusted with reason note
- ✅ Transaction history shows all changes with timestamps
- ✅ Low-stock parts appear in banner & on dashboard
- ✅ Part search works by name/reference
- ✅ Category filtering works

### Parts Assignment
- ✅ Part can be assigned to repair if stock > 0
- ✅ Stock decrements atomically on assignment
- ✅ Unit cost frozen at assignment time
- ✅ Manager can override zero-stock with warning
- ✅ Override is logged in stock transactions
- ✅ RepairPart removal restores stock
- ✅ Parts total recalculates on changes

### Labor Items
- ✅ Labor item can be added (description + cost)
- ✅ Labor item can be edited/removed
- ✅ Labor total recalculates on changes
- ✅ Final repair total includes labor

### Invoicing
- ✅ Payment can only be registered when status = Complete
- ✅ Invoice number generated sequentially (INV-YYYY-XXXXX)
- ✅ Invoice is immutable after creation
- ✅ Invoice shows parts, labor, discount, totals
- ✅ Invoice printable & shareable via WhatsApp
- ✅ Invoice visible to client on portal (if their repair)

---

## Backend Dependencies
- All Phase 2 API endpoints working
- Repair state machine enforced (status transitions)
- Part, StockTransaction, RepairPart models in Prisma

---

## Frontend Dependencies
- All Phase 2 UI components working
- Repair detail page structure in place
- API client configured in `lib/api-client.ts`

---

## Next Steps After Phase 3

1. **Phase 4 — Client Experience & Reporting (Weeks 9–10)**
   - Client portal (OTP login, car tracking, invoice viewing)
   - WhatsApp notifications (T-01 through T-06)
   - End-of-day reports
   - KPI dashboard

2. **Phase 5 — Polish & Deployment**
   - Full end-to-end testing
   - Accessibility audit
   - Performance optimization
   - Docker build & deployment
   - Production hardening

---

## Files Summary

**Backend files to create/modify:**
- `apps/api/src/routes/v1/parts/index.ts`
- `apps/api/src/routes/v1/payments/index.ts` (enhance)
- `apps/api/src/services/stock.service.ts` (new)
- `apps/api/src/services/invoice.service.ts` (verify)

**Frontend files to create/modify:**
- `apps/web/src/app/(internal)/stock/page.tsx` (enhance)
- `apps/web/src/app/(internal)/stock/new/page.tsx` (new)
- `apps/web/src/app/(internal)/stock/[id]/page.tsx` (new)
- `apps/web/src/app/(internal)/repairs/[id]/page.tsx` (enhance for parts, labor, payment)
- `apps/web/src/app/(internal)/repairs/[id]/invoice/page.tsx` (new)
- `apps/web/src/components/stock/` (new components)
- `apps/web/src/components/payment/` (new components)

---

## Estimated Total Time

- Task 1 (Stock API): 3-4 hours
- Task 2 (Stock UI): 3-4 hours
- Task 3 (Parts Assignment & Labor API): 3-4 hours
- Task 4 (Parts Assignment & Labor UI): 2-3 hours
- Task 5 (Invoicing): 2-3 hours
- Task 6 (Invoice UI): 2-3 hours
- Task 7 & 8 (Testing): 4-6 hours

**Total: 20-30 hours**

Priority: HIGH (core financial workflow)
