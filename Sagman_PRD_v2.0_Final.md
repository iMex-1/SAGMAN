# Sagman — Garage Management System

## Product Requirements Document

**Version:** 2.0 (Final)  
**Status:** Final  
**Scope:** Single-garage deployment  
**Date:** 2026-06-26  
**Author:** Product Team  

---

## 1. Executive Summary

Sagman is a responsive web-based garage management system designed for a single automotive repair workshop. It covers the full operational lifecycle: client appointment booking, car intake, mechanic assignment, diagnosis, repair tracking, parts consumption, payment, invoicing, and reporting. The overseer receives a daily WhatsApp report and has a read-only KPI dashboard. Clients have a self-service portal to book appointments and track their car's repair status in real time.

**Four user types:** Overseer, Manager, Mechanic, Client.  
**Deployment model:** Single-garage. No multi-tenancy.

---

## 2. Goals & Success Metrics

### 2.1 Primary Goals

1. Replace paper-based tracking with a real-time digital system.
2. Give the overseer full visibility of garage performance without being on-site.
3. Give clients transparency about their car's repair progress.
4. Enforce accountability for repair timelines with documented delay justification.
5. Manage parts stock with automatic decrement and low-stock alerts.
6. Enable fast global search across all operational records.

### 2.2 Success Metrics

| Metric | Target |
|--------|--------|
| Repair status currency | 100% of active repairs updated same working day |
| On-time completion visibility | Manager sees % delivered on or before estimated date |
| Stock accuracy | All parts usage tracked, zero silent stockouts |
| Delay accountability | 100% of delayed repairs have a documented reason |
| Client self-service | Clients can book and track without calling the garage |
| Search coverage | All matricules, clients, phones, invoices, and repair IDs searchable in < 500ms |

---

## 3. User Roles

### 3.1 Overseer
The garage owner. Primarily receives the daily WhatsApp report from the manager. Has a read-only KPI dashboard login if he wants to check figures directly. No operational permissions.

### 3.2 Manager
Full access to every module. Manages employees, approves appointments, oversees all repairs, handles payments, generates reports, manages stock, and sends client notifications via WhatsApp templates. Configures system settings.

### 3.3 Mechanic
Executes repair work. Updates status and logs work on assigned repairs only. Assigns parts from stock. Cannot access financial data, approve appointments, or manage employees.

### 3.4 Client
Books appointments via the portal. Tracks their own car's repair status. Sees their own diagnosis results (when shared) and invoices. Cannot see any other client's data.

---

## 4. Permissions Matrix

| Action | Overseer | Manager | Mechanic | Client |
|--------|----------|---------|----------|--------|
| View KPI dashboard | R | R | — | — |
| Manage employees (add/edit/deactivate) | — | ✓ | — | — |
| View employee list | — | R | — | — |
| Create appointment | — | ✓ | — | ✓ (portal) |
| Accept / reschedule / cancel appointment | — | ✓ | — | — |
| View all appointments | — | ✓ | Own schedule | — |
| Register car intake | — | ✓ | — | — |
| Create repair job | — | ✓ | — | — |
| Assign mechanic to repair | — | ✓ | — | — |
| Fill diagnosis report | — | ✓ | ✓ (assigned) | — |
| Update repair status | — | ✓ | ✓ (assigned) | — |
| Log repair work / notes | — | ✓ | ✓ (assigned) | — |
| Assign parts to repair | — | ✓ | ✓ (assigned) | — |
| Add stock (receiving parts) | — | ✓ | — | — |
| View stock levels | — | ✓ | ✓ | — |
| Register payment | — | ✓ | — | — |
| View payment history | — | ✓ | — | — |
| Generate / send WhatsApp templates | — | ✓ | — | — |
| Submit delay reason | — | ✓ | — | — |
| Generate end-of-day report | — | ✓ | — | — |
| View calendar | — | ✓ | ✓ | — |
| Reschedule on calendar | — | ✓ | — | — |
| View own car status | — | — | — | ✓ |
| View own invoices | — | — | — | ✓ |
| Book appointment (portal) | — | — | — | ✓ |
| Edit system settings | — | ✓ | — | — |
| Global search | — | ✓ | — | — |
| View notification log | — | ✓ | — | — |

---

## 5. Feature Specifications

### 5.1 Authentication

#### 5.1.1 Internal System (Overseer, Manager, Mechanic)
- Email + password login.
- Role assigned at account creation by a Manager.
- Session auto-expires after 8 hours of inactivity (configurable in system settings).
- Password reset done by the Manager — no self-service email reset in v1.

#### 5.1.2 Client Portal
- Phone number + 6-digit OTP (changed from 4-digit for improved security).
- OTP valid for 10 minutes.
- Session valid for 7 days.
- No email required. Phone number is the client's unique identifier.

### 5.2 Employee Management

**Fields per employee:**
- Full name
- Role: Manager or Mechanic
- Phone number
- Join date
- Specialty (free text — e.g., "Engine, Suspension")
- Status: Active / Inactive

**Rules:**
- Only Manager can add, edit, or deactivate employees.
- Employee accounts are never deleted — only deactivated. This preserves historical repair logs.
- An inactive employee cannot be assigned to new repairs.
- At least one active Manager account must exist at all times. Deactivating the last Manager is blocked.

### 5.3 Appointment Management

**Appointment fields:**
- Client name (linked to registered client or free text for walk-ins)
- Client phone number
- Car (linked record or manual: matricule, make, model)
- Purpose / reported issue description
- Requested date and time
- Manager notes (internal)
- Status: Pending / Confirmed / Rescheduled / Cancelled / Converted to Repair
- Soft delete support (`deleted_at` timestamp)

#### 5.3.1 Client-Initiated Flow (Portal)
1. Client submits appointment request on portal.
2. Status: Pending. Manager sees it on the dashboard.
3. Manager confirms or proposes a new date.
4. Status updates. Client sees new status on portal.
5. Manager sends WhatsApp confirmation template manually (T-01 or T-02).

#### 5.3.2 Manager-Initiated Flow (Internal)
1. Manager creates appointment directly.
2. Status: Confirmed immediately.
3. WhatsApp template available to notify client.

#### 5.3.3 Converting to Repair
When the car arrives, Manager clicks "Create Repair Job" from the appointment. The appointment status changes to "Converted" and all car/client data pre-fills the repair form. An appointment that has been "Converted to Repair" cannot be edited or re-used.

**Rules:**
- The garage has a configurable maximum concurrent cars (default: 5). Manager is warned when confirming an appointment would exceed that day's capacity.
- A confirmed appointment appears on the garage calendar.
- Cancellation requires a reason note.
- Cancellation returns the capacity slot.
- Appointments support soft delete (`deleted_at`) to preserve history while allowing cleanup.

### 5.4 Car Management

**Car record fields:**
- Matricule / plate number (unique system identifier)
- Make, model, year
- Color
- Mileage at intake
- VIN (optional)
- Linked client (optional — walk-ins have no client account)
- Notes
- Soft delete support (`deleted_at` timestamp)

**Rules:**
- Car is registered at intake by the Manager.
- A car with the same matricule cannot have two simultaneously active repair jobs.
- Full repair history is viewable by the Manager per car.
- If the car is linked to a registered client, the client sees it in their portal.
- Cars support soft delete (`deleted_at`) to preserve historical repair associations.

### 5.5 Repair Management

Core of the system.

**Repair job fields:**
- Car (linked)
- Created by (Manager)
- Primary mechanic (required to start)
- Secondary mechanics (optional)
- Priority: Low / Normal / High / Emergency (default: Normal)
- Reported problem description
- Internal notes
- Diagnosis report (structured, see 5.6)
- Diagnosis shared with client (boolean)
- Client approval status: Pending / Approved / Rejected / Bypassed
- Estimated duration (hours or days)
- Estimated cost (auto-calculated: parts total + labor total, editable by Manager)
- Target completion date (set at job creation)
- Actual completion date
- Current status
- Reopened reason (mandatory when transitioning Complete → In Progress)

**Priority Usage:**
- Dashboard sorting: Emergency and High appear first.
- Calendar visibility: Color-coded priority indicator on calendar entries.
- Manager alerts: High/Emergency repairs trigger dashboard notification banners.

**Status state machine:**

```
Received ──► Diagnosing ──► Awaiting Approval ──► In Progress ──► Complete ──► Delivered
                │                   │                    │               │
                │                   │                    ▼               │
                │                   │           Waiting for Parts ───────┘
                │                   │           (back to In Progress when parts arrive)
                └───────────────────┴────────────► Cancelled (from any state except Delivered)
```

**Status definitions:**

| Status | Description |
|--------|-------------|
| Received | Car arrived at garage, job created. |
| Diagnosing | Mechanic inspecting the vehicle. |
| Awaiting Approval | Diagnosis done, sent to client, waiting for green light. |
| In Progress | Client approved, active repair work underway. |
| Waiting for Parts | Repair blocked — part not available. Delay clock paused. |
| Complete | All work done. Car ready for pickup. Payment can be registered. |
| Delivered | Payment confirmed. Car handed to client. Immutable. |
| Cancelled | Repair abandoned. Requires cancellation reason. Immutable. |

**Repair timeline and delay accountability:**
- Manager sets target completion date when creating the job.
- If that date passes and status is not Complete, Delivered, or Cancelled:
  - Repair card is flagged Overdue (red indicator).
  - Manager must submit a delay report before any status change is permitted.
- Delay report fields: reason (required text), evidence description (optional text).
- Time in "Waiting for Parts" is excluded from the delay clock.

**Mechanic repair log entries (per repair, manual):**
- What was done (text)
- Time spent (hours)
- Timestamp (auto)

**Automatic status log (every status change):**
- From status / To status
- Changed by
- Timestamp
- Note (optional for mechanic, required when manager overrides)

**Repair reopening:**
- Transition Complete → In Progress is permitted for Managers only.
- Requires a mandatory "Reopened Reason" (e.g., "Customer returned due to vibration").
- Logged in the status audit trail.

### 5.6 Diagnosis Workflow

After initial inspection, the assigned mechanic or Manager fills the diagnosis report.

**Diagnosis report fields:**
- Issue list: [issue description + severity: Minor / Moderate / Critical]
- Recommended repairs (text)
- Parts required (selected from catalog — pre-fills cost estimate)
- Labor items required (structured list: description + cost)
- Estimated total cost (auto-calculated: parts + labor, editable by Manager)
- Estimated repair duration
- Additional notes

**Flow:**
1. Mechanic fills diagnosis.
2. Manager reviews (optional gate — configurable in settings: `require_diagnosis_approval`).
3. Manager clicks "Share with Client" — sets the `diagnosis_shared` flag.
4. Manager sends WhatsApp T-03 template to client.
5. Client responds (by phone or portal). Manager records approval/rejection in system.
6. On approval: status → In Progress.
7. On rejection: status → Cancelled (with reason).
8. Override: Manager can bypass client approval and move to In Progress directly. This is logged as a "Bypassed" approval with a required reason.

### 5.7 Parts & Stock Management

**Part catalog fields:**
- Part name
- Reference / part number
- Category (Engine / Brakes / Electrical / Bodywork / Suspension / Other)
- Compatible models (free text)
- Unit cost (DH)
- Quantity in stock
- Minimum stock threshold
- Supplier name
- Soft delete support (`deleted_at` timestamp)

**Stock transaction log (every quantity change):**

| Type | Triggered by |
|------|-------------|
| Received | Manager adds new stock |
| Used | Part assigned to a repair |
| Adjustment | Manual correction by Manager |

Every transaction records: quantity change, quantity after, related repair (if Used), done by, timestamp, note.

**Parts assignment to a repair:**
- Mechanic or Manager selects parts from catalog inside the repair job.
- Quantity entered.
- On confirmation: stock decrements immediately. Part + cost logged to repair.
- If stock of a selected part is zero: warning shown. Manager can override (for externally sourced parts). Override is logged.
- Parts cost at time of use is recorded on the repair (`unit_cost_at_time`), not recalculated if the part's catalog unit cost changes later.

**Low stock dashboard alert:**
- Permanent alert banner on Manager dashboard listing all parts at or below their minimum threshold: part name, current quantity, minimum threshold.

### 5.8 Payment & Invoicing

**Payment entry fields:**
- Repair job (linked)
- Payment date
- Method: Cash (Espèce) — v1 only
- Amount billed (auto-calculated from parts + labor + discount, editable)
- Parts total, labor total, discount amount, final total
- Amount received
- Change due (auto-calculated)
- Received by (manager/employee)
- Notes

**Rules:**
- Payment can only be registered when status is "Complete."
- Status → "Delivered" requires payment to be confirmed first.
- A registered payment is immutable. Corrections require a new adjustment entry with a note.
- Status "Delivered" is immutable. No edits to the repair or payment are permitted after delivery.
- Status "Cancelled" is immutable. A new repair job must be created if the client returns.

**Invoice (auto-generated):**
- Invoice number format: `INV-YYYY-XXXXX` (e.g., `INV-2026-00001`)
- Garage name, address, phone, logo
- Sequential invoice number
- Date
- Client name and phone
- Car: make, model, matricule
- Labor: itemized descriptions + costs
- Parts used: name, quantity, unit cost, subtotal
- Parts total, labor total, discount, grand total
- Total amount due
- Amount received and change (cash)
- Mechanic name(s)
- Manager name
- Invoice is: viewable on screen, printable via browser, and shareable via WhatsApp T-05 template.

### 5.9 KPI Dashboard

Visible to: Overseer (read-only) and Manager.

**Summary cards** (switchable: Today / This Week / This Month):
- Total revenue
- Cars received
- Cars delivered
- Average repair duration (working days)
- On-time completion rate (% delivered on or before target date)
- Number of delayed repairs + delay reports filed

**Live state widgets:**
- Cars currently in the garage (total + breakdown by status)
- Overdue repairs (count + car list)
- Low stock parts (count + names)
- Pending appointments (count)
- High/Emergency priority repairs (count + list)

**Mechanic performance table** (current month):
| Mechanic | Cars completed | Avg. time per repair | Delays caused |

**Revenue bar chart:** Daily revenue for the current month.

### 5.10 End-of-Day Report

System auto-generates report content at end of working day. Manager reviews, edits the free notes field, and sends to the overseer via WhatsApp template T-06.

**Report content (auto-filled):**
- Date and time
- Cars received today (count + list)
- Cars delivered today (count + revenue)
- Total revenue today
- Active repairs in garage (count + status breakdown per car)
- Overdue repairs: car + delay duration + delay reason
- Low stock alerts
- Free notes (manager fills manually)

**Delivery:** Manager clicks "Generate Report" → reviews preview → clicks "Send to Overseer via WhatsApp" → WhatsApp opens with pre-filled message to the overseer's configured number.

### 5.11 Calendar & Planning

**Views:**
- Day view: all repairs active today, grouped by mechanic
- Week view: repairs and appointments for the week
- Month view: car count per day (density overview)

**Each calendar entry shows:**
- Car (make + matricule)
- Assigned mechanic
- Status (color-coded)
- Priority indicator (badge for High/Emergency)
- Target completion date

**Status color coding:**

| Status | Color |
|--------|-------|
| Received | Gray |
| Diagnosing | Blue |
| Awaiting Approval | Amber |
| In Progress | Purple |
| Waiting for Parts | Orange |
| Complete | Green |
| Overdue | Red |
| Delivered | Light gray (faded) |

**Manager actions from calendar:**
- Click any entry → view repair detail
- Reschedule target date (requires a note)
- View mechanic workload (active repairs per mechanic per day)

### 5.12 Client Portal

**Public landing page** (no login):
- Garage name and logo
- Services offered
- Address, phone, working hours
- "Book an appointment" CTA

**Authenticated area** (phone + OTP):
- My Cars — list of registered vehicles
- Per car: current status, status timeline, estimated completion date, priority (if shared)
- Diagnosis results (only when manager has shared them via `diagnosis_shared = true`)
- Past repairs with invoices
- Book new appointment form

**Appointment booking form:**
- Select from registered cars or enter new matricule
- Describe the issue
- Choose preferred date from calendar (only available days shown)
- Optional notes
- Submit → creates Pending appointment in system

**Client cannot:**
- See any other client's data
- Modify or cancel an appointment directly (must call the garage)
- See financial summary or other clients' invoices
- See internal notes on their repair

### 5.13 WhatsApp Notification Triggers

No API integration. All WhatsApp communication is triggered by the Manager clicking a button that opens a pre-filled WhatsApp message via `wa.me` link. Manager reviews and sends with one tap.

Phone numbers must be stored in E.164 format (e.g., `+212xxxxxxxxx`).

**Notification Log:** All WhatsApp sends are tracked in a `NotificationLog` table for audit and history.

| Event | Template | Logged |
|-------|----------|--------|
| Appointment confirmed | T-01 | ✓ |
| Appointment rescheduled | T-02 | ✓ |
| Diagnosis shared with client | T-03 | ✓ |
| Car ready for pickup | T-04 | ✓ |
| Invoice after delivery | T-05 | ✓ |
| End-of-day report to overseer | T-06 | ✓ |

### 5.14 Global Search

**Available to:** Manager only.

**Searchable fields:**
- Matricule (exact and partial)
- Client name (partial, case-insensitive)
- Client phone number (partial)
- Invoice number (exact)
- Repair ID (exact)

**Behavior:**
- Single search bar in the top navigation.
- Results grouped by entity type: Cars, Clients, Repairs, Invoices.
- Clicking a result navigates directly to the detail view.
- Target response time: < 500ms for up to 10,000 records.

### 5.15 Repair Photos

**RepairPhoto entity:**
- `id`
- `repair_id` (FK → RepairJob)
- `uploaded_by` (FK → User)
- `type`: before / during / after
- `file_path`
- `created_at`

**Uses:**
- Damage evidence
- Client trust and transparency
- Workshop documentation
- Quality control and dispute resolution

**Rules:**
- Photos can be uploaded by Manager or assigned Mechanic.
- Maximum file size: 5MB per image.
- Supported formats: JPG, PNG.
- Photos are visible on the repair detail page and included in the client portal when the repair is linked to the client.

---

## 6. Business Rules

| ID | Rule |
|----|------|
| BR-001 | A repair cannot move to "In Progress" without at least one mechanic assigned. |
| BR-002 | A mechanic can only update the status and logs of repairs assigned to them. Managers can update any repair. |
| BR-003 | A part cannot be assigned to a repair if stock quantity is zero, unless a Manager explicitly overrides. Override is logged. |
| BR-004 | If a repair's target completion date passes and status is not Complete, Delivered, or Cancelled — the repair is flagged Overdue. The Manager must file a delay report before any status update is permitted. |
| BR-005 | Time spent in "Waiting for Parts" status is excluded from the delay clock. |
| BR-006 | Payment can only be registered when status is "Complete." |
| BR-007 | Status → "Delivered" requires payment to be registered first. |
| BR-008 | A car cannot have two simultaneously active repair jobs. Active means any status except Delivered or Cancelled. |
| BR-009 | Employee accounts are never deleted. Deactivation only. This preserves all historical logs. |
| BR-010 | At least one active Manager account must exist. Deactivating the last Manager is blocked by the system. |
| BR-011 | A client can only see their own cars, repairs, and invoices on the portal. |
| BR-012 | Confirming an appointment that would exceed the garage's daily capacity limit triggers a warning. Manager must acknowledge before confirming. |
| BR-013 | Status "Delivered" is immutable. No edits to the repair or payment are permitted after delivery. |
| BR-014 | Status "Cancelled" is immutable. A new repair job must be created if the client returns. |
| BR-015 | Diagnosis results are only visible to the client on the portal when the Manager explicitly sets `diagnosis_shared = true`. |
| BR-016 | Client approval bypass (skipping the Awaiting Approval status) is permitted for Managers only and must be logged with a reason. |
| BR-017 | Stock adjustments (manual quantity corrections) require a reason note and are always logged in the transaction history. |
| BR-018 | Invoice amounts auto-calculate from parts + labor but are editable by the Manager before payment confirmation. |
| BR-019 | The overseer's WhatsApp number is set in system settings by the Manager only. |
| BR-020 | Multiple mechanics can be assigned to one repair. One must be designated as primary. |
| BR-021 | An appointment that has been "Converted to Repair" cannot be edited or re-used. |
| BR-022 | Parts cost at time of use is recorded on the repair, not recalculated if the part's unit cost changes later. |
| BR-023 | Repair priority affects dashboard sorting, calendar display, and manager alert banners. |
| BR-024 | Labor costs are structured as individual line items (description + cost), not a single flat rate. |
| BR-025 | All WhatsApp notifications sent via the system are logged in `NotificationLog` for audit. |
| BR-026 | Global search must return results across matricules, client names, phones, invoice numbers, and repair IDs. |
| BR-027 | Client portal OTP is 6 digits, valid for 10 minutes. |
| BR-028 | Cars, Parts, and Appointments support soft delete (`deleted_at`) to preserve historical data. |
| BR-029 | Invoice numbers follow the format `INV-YYYY-XXXXX` with sequential numbering per year. |
| BR-030 | Transition Complete → In Progress requires a mandatory "Reopened Reason" and is logged. |
| BR-031 | Repair photos are restricted to 5MB, JPG/PNG only, and visible to the client when linked to their car. |

---

## 7. Data Models

### 7.1 User (internal accounts)
```
id, name, email, password_hash, role (overseer|manager|mechanic),
phone, specialty, status (active|inactive), created_at
```

### 7.2 Client (portal users)
```
id, name, phone [unique], otp_code, otp_expires_at, created_at
```

### 7.3 Car
```
id, matricule [unique], make, model, year, color, vin,
client_id [nullable FK → Client], notes, deleted_at, created_at
```

### 7.4 Appointment
```
id, client_id [nullable FK → Client], client_name, client_phone,
car_id [nullable FK → Car], car_matricule, purpose,
requested_at, confirmed_at, rescheduled_to,
status [pending|confirmed|rescheduled|cancelled|converted],
cancellation_reason, created_by [FK → User], notes, deleted_at, created_at
```

### 7.5 RepairJob
```
id, car_id [FK → Car], appointment_id [nullable FK → Appointment],
created_by [FK → User], primary_mechanic_id [FK → User],
status [received|diagnosing|awaiting_approval|in_progress|
        waiting_for_parts|complete|delivered|cancelled],
priority [low|normal|high|emergency],
description, diagnosis_report [JSON], diagnosis_shared [boolean],
client_approval_status [pending|approved|rejected|bypassed],
client_approval_bypass_reason,
estimated_duration_hours, estimated_cost,
parts_total, labor_total, discount_amount, final_total,
target_completion_date, actual_completion_date,
cancellation_reason, reopened_reason, created_at, updated_at
```

### 7.6 RepairMechanic (many-to-many)
```
repair_id [FK → RepairJob], mechanic_id [FK → User],
is_primary [boolean], assigned_at
```

### 7.7 RepairStatusLog (immutable audit trail)
```
id, repair_id [FK → RepairJob], from_status, to_status,
changed_by [FK → User], note, created_at
```

### 7.8 RepairWorkLog (mechanic manual entries)
```
id, repair_id [FK → RepairJob], mechanic_id [FK → User],
description, hours_spent, logged_at
```

### 7.9 DelayReport
```
id, repair_id [FK → RepairJob], reported_by [FK → User],
reason, evidence_note, created_at
```

### 7.10 Part
```
id, name, reference, category, compatible_models,
unit_cost, quantity, min_threshold, supplier, deleted_at, created_at, updated_at
```

### 7.11 StockTransaction
```
id, part_id [FK → Part], type [received|used|adjustment],
quantity_change, quantity_after,
repair_id [nullable FK → RepairJob],
done_by [FK → User], note, created_at
```

### 7.12 RepairPart (parts used in a repair)
```
id, repair_id [FK → RepairJob], part_id [FK → Part],
quantity_used, unit_cost_at_time,
added_by [FK → User], added_at
```

### 7.13 LaborItem (structured labor costs per repair)
```
id, repair_id [FK → RepairJob],
description, cost,
added_by [FK → User], added_at
```

### 7.14 Payment
```
id, repair_id [FK → RepairJob], amount_billed, amount_received,
change_due, method [cash], paid_by_name,
received_by [FK → User], notes, created_at
```

### 7.15 RepairPhoto
```
id, repair_id [FK → RepairJob], uploaded_by [FK → User],
type [before|during|after], file_path, created_at
```

### 7.16 NotificationLog
```
id, type [template_code], recipient_phone, sent_by [FK → User],
message_preview, repair_id [nullable], appointment_id [nullable],
sent_at
```

### 7.17 SystemSettings
```
key, value — covers: garage_name, garage_address, garage_phone,
garage_logo_url, max_concurrent_cars, working_hours,
overseer_whatsapp_number, require_diagnosis_approval,
require_client_approval, currency_label
```

---

## 8. Repair Status State Machine (Formal)

**Allowed transitions:**

```
Received          → Diagnosing | Cancelled
Diagnosing        → Awaiting Approval | In Progress (bypass) | Cancelled
Awaiting Approval → In Progress (approved) | Cancelled (rejected)
In Progress       → Waiting for Parts | Complete | Cancelled
Waiting for Parts → In Progress | Cancelled
Complete          → Delivered | In Progress (rework — manager only, logged, requires reopened_reason)
Delivered         → [TERMINAL — immutable]
Cancelled         → [TERMINAL — immutable]
```

**Overdue flag:**
- Active when: `current_date > target_completion_date` AND `status NOT IN (Complete, Delivered, Cancelled)`
- Time in "Waiting for Parts" is excluded from the calculation.
- Effect: blocks status updates until delay report is filed.

---

## 9. WhatsApp Message Templates

**Mechanism:** Manager clicks "Send via WhatsApp" on any triggered event. System opens:
```
https://wa.me/[phone_e164]?text=[url_encoded_message]
```
WhatsApp opens (web or app) with the message pre-filled. Manager reviews and sends.

Phone numbers must be stored in E.164 format (e.g., `+212xxxxxxxxx`).

All sends are logged to `NotificationLog`.

### T-01 — Appointment Confirmation

**Sent to:** Client — Trigger: Appointment confirmed by Manager

```
Bonjour [Prénom Client],

Votre rendez-vous au Garage Sagman est confirmé.

📅 Date : [Jour DD/MM/YYYY]
⏰ Heure : [HH:MM]
🚗 Véhicule : [Marque Modèle] — [Matricule]
🔧 Motif : [Motif]

Merci de vous présenter à l'heure.
Pour toute question : [Téléphone Garage]

Garage Sagman
```

### T-02 — Appointment Rescheduled

**Sent to:** Client — Trigger: Manager reschedules appointment

```
Bonjour [Prénom Client],

Votre rendez-vous a été déplacé.

📅 Nouvelle date : [Jour DD/MM/YYYY]
⏰ Nouvelle heure : [HH:MM]
🚗 Véhicule : [Marque Modèle] — [Matricule]

Nous nous excusons pour la gêne occasionnée.
Contact : [Téléphone Garage]

Garage Sagman
```

### T-03 — Diagnosis Results

**Sent to:** Client — Trigger: Manager clicks "Share with Client"

```
Bonjour [Prénom Client],

Le diagnostic de votre véhicule est terminé.

🚗 Véhicule : [Marque Modèle] — [Matricule]
📆 Date du diagnostic : [DD/MM/YYYY]

PROBLÈMES IDENTIFIÉS :
[• Problème 1 — Gravité : Mineur]
[• Problème 2 — Gravité : Critique]

TRAVAUX RECOMMANDÉS :
[• Description des réparations]

💰 Estimation : [Montant] DH
⏱ Durée estimée : [X jours]

Merci de nous confirmer votre accord pour procéder.
Contact : [Téléphone Garage]

Garage Sagman
```

### T-04 — Car Ready for Pickup

**Sent to:** Client — Trigger: Repair status → Complete

```
Bonjour [Prénom Client],

Votre véhicule est prêt à être récupéré.

🚗 Véhicule : [Marque Modèle] — [Matricule]
🔧 Travaux effectués : [Résumé des réparations]
💰 Montant à régler : [Montant] DH

Vous pouvez passer le récupérer pendant nos heures d'ouverture.
Contact : [Téléphone Garage]

Garage Sagman
```

### T-05 — Invoice

**Sent to:** Client — Trigger: Manager clicks "Send Invoice" after payment

```
Bonjour [Prénom Client],

Voici votre reçu pour les travaux effectués.

════════════════════════
    FACTURE SAGMAN
════════════════════════
N° : [INV-YYYY-XXXXX]          Date : [DD/MM/YYYY]

Client : [Nom Complet]
Tél.   : [Téléphone]
Véhicule : [Marque Modèle]
Matricule : [Matricule]

MAIN D'ŒUVRE :
• [Description travail] .............. [Montant] DH

PIÈCES :
• [Pièce 1] × [Qté] ................. [Montant] DH
• [Pièce 2] × [Qté] ................. [Montant] DH

────────────────────────
PARTS TOTAL     [Parts Total] DH
LABOR TOTAL     [Labor Total] DH
DISCOUNT        [Discount] DH
GRAND TOTAL     [Final Total] DH
Reçu            [Reçu] DH
Rendu           [Rendu] DH
────────────────────────

Mécanicien : [Nom]
Responsable : [Nom Manager]

Merci de votre confiance.
Garage Sagman — [Adresse] — [Tél]
════════════════════════
```

### T-06 — End-of-Day Report (to Overseer)

**Sent to:** Overseer's configured number — Trigger: Manager generates daily report

```
RAPPORT JOURNALIER
GARAGE SAGMAN
════════════════════════
📅 Date : [DD/MM/YYYY]
⏰ Heure : [HH:MM]
👤 Responsable : [Nom Manager]

ACTIVITÉ DU JOUR
────────────────
Véhicules reçus    : [N]
Véhicules livrés   : [N]
Chiffre d'affaires : [Montant] DH

ATELIER EN COURS ([N] véhicules)
────────────────
[• Marque Modèle — Matricule — Statut — Mécanicien]
[• ...]

RETARDS
────────────────
[• Marque Modèle — Matricule
   Retard : [X] jours
   Raison : [Raison documentée]]
[AUCUN RETARD] ← if none

ALERTES STOCK
────────────────
[• Nom pièce — Qté restante: X (min: Y)]
[AUCUNE ALERTE] ← if none

NOTES DU RESPONSABLE
────────────────
[Saisie libre du manager]

════════════════════════
Garage Sagman
```

---

## 10. Out of Scope — Version 1

The following are explicitly excluded from v1 and reserved for future versions.

- Multi-garage / multi-branch support
- Digital payment (card, virement, mobile wallet)
- Automated WhatsApp messages via official API (all sends remain manual via wa.me)
- SMS notifications
- Supplier order management and purchase orders
- Two-way chat between client and garage on the portal
- Employee attendance / time clock
- Warranty tracking per repair
- Arabic / Darija interface language
- Mobile native app (iOS / Android)
- Accounting or bookkeeping software integration
- Customer satisfaction ratings

---

## 11. System Settings (Configurable by Manager)

| Setting | Description | Default |
|---------|-------------|---------|
| Garage name | Display name across system and templates | — |
| Garage address | Used in invoices and templates | — |
| Garage phone | Used in templates | — |
| Garage logo | Shown in portal and invoices | — |
| Max concurrent cars | Capacity cap for appointment confirmation | 5 |
| Working days / hours | Used in calendar and capacity planning | Mon–Sat 08:00–18:00 |
| Overseer WhatsApp number | Target for T-06 daily report | — |
| Require manager approval of diagnosis | Gate between mechanic diagnosis and client share | On |
| Require client approval before starting repair | Can be turned off for walk-in quick jobs | On |
| Currency label | Label for monetary values | DH |

---

## 12. Technical Architecture & Stack

### 12.1 Overview

Sagman is a responsive web application optimized for desktop (manager operations) and mobile/tablet (mechanic field updates). It operates as a single-tenant system deployed on one server instance.

### 12.2 Recommended Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | Next.js 15 (App Router, React 19) | SSR/SSG for fast initial loads, API routes for internal BFF pattern, excellent mobile responsiveness, strong ecosystem |
| **Backend** | Node.js + Fastify | High-performance, low-overhead HTTP framework; excellent for JSON APIs; schema-based validation with TypeScript; faster than Express for I/O-heavy operations |
| **Database** | PostgreSQL 16 | ACID compliance, robust JSON support for diagnosis reports, excellent relational integrity for garage operations, mature Moroccan hosting support |
| **ORM / Query Builder** | Prisma ORM | Type-safe database access, automatic migration generation, excellent PostgreSQL support, intuitive schema modeling |
| **Authentication (Internal)** | JWT (access + refresh tokens) | Stateless, scalable, easy to implement with Fastify `@fastify/jwt` |
| **Authentication (Client)** | OTP stored in DB with TTL | Simple, no external SMS dependency in v1; OTP generated server-side, validated with expiry check |
| **File Storage (Photos)** | Local filesystem → S3-compatible (future) | v1 stores on server disk; paths saved in DB. Future migration to MinIO or AWS S3 planned. |
| **Search** | PostgreSQL Full-Text Search + Trigram indexes | Sufficient for < 50,000 records; no external search engine needed in v1 |
| **Caching** | Redis (optional) | Session store for client OTP, optional query caching. Can be deferred to v1.1 if budget-constrained. |
| **Deployment** | Docker + Docker Compose | Single VPS deployment, reproducible builds, easy backup orchestration |
| **Hosting** | Single VPS — 2 vCPUs, 4 GB RAM | Sufficient for a single garage. Vertical scaling not needed in v1. |
| **Backup** | Daily automated PostgreSQL dump | `pg_dump` via cron to secondary storage location (local backup disk or cloud bucket). Minimum 7-day retention. |
| **Reverse Proxy** | Nginx | SSL termination, static asset serving, rate limiting |
| **Process Manager** | PM2 | Production Node.js process management with auto-restart |

### 12.3 Application Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENTS                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Manager    │  │   Mechanic   │  │    Client    │      │
│  │  (Desktop)   │  │ (Mobile/Tab) │  │  (Mobile)    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼─────────────────┼─────────────────┼───────────────┘
          │                 │                 │
          └─────────────────┴─────────────────┘
                            │
                    ┌───────▼────────┐
                    │     Nginx      │  ← SSL, Static Files, Rate Limit
                    └───────┬────────┘
                            │
                    ┌───────▼────────┐
                    │    Next.js     │  ← Frontend (App Router)
                    │   (Port 3000)  │
                    └───────┬────────┘
                            │ API Calls (REST/JSON)
                    ┌───────▼────────┐
                    │    Fastify     │  ← Backend API (Port 4000)
                    │   (Node.js)    │
                    └───────┬────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
       ┌──────▼──────┐ ┌───▼────┐ ┌─────▼──────┐
       │  PostgreSQL │ │  Redis │ │  Local FS  │
       │   (Port 5432)│ │(Optional)│ │  (Photos)  │
       └─────────────┘ └────────┘ └────────────┘
```

### 12.4 API Design Principles

- **RESTful JSON API** between Next.js frontend and Fastify backend.
- **Resource-based URLs:** `/api/repairs`, `/api/parts`, `/api/appointments`.
- **Versioning:** URL-based (`/api/v1/...`) from day one to allow future evolution.
- **Authentication:** JWT Bearer token for internal users. Phone + OTP session for clients.
- **Validation:** Zod schemas shared between frontend and backend (via shared package or tRPC-style inference) for type safety.
- **Error Handling:** Standardized error response format:
  ```json
  {
    "error": {
      "code": "REPAIR_NOT_FOUND",
      "message": "Repair job with id 123 does not exist",
      "statusCode": 404
    }
  }
  ```
- **Pagination:** Cursor-based for repair lists and logs; offset-based for simple catalogs (parts, employees).

### 12.5 Database Schema Notes

- **Prisma Schema** is the single source of truth for all data models.
- **Migrations:** Managed via Prisma Migrate. Every schema change is a migration file.
- **Indexes:**
  - `Car.matricule` — unique index (case-insensitive via `citext` or functional index).
  - `Client.phone` — unique index.
  - `RepairJob.car_id + status` — composite index for active repair lookups.
  - `RepairJob.target_completion_date` — index for overdue queries.
  - `Part.quantity + min_threshold` — partial index for low-stock alerts.
  - `NotificationLog.sent_at` — index for report generation.
  - GIN indexes on `diagnosis_report` JSONB for flexible diagnosis queries.
  - Trigram indexes on `Car.matricule`, `Client.name`, `Client.phone` for global search.

### 12.6 Security Considerations

- **Password hashing:** bcrypt with cost factor 12 for internal users.
- **OTP generation:** Cryptographically secure random 6-digit code (Node.js `crypto.randomInt`).
- **SQL Injection:** Eliminated via Prisma parameterized queries.
- **XSS:** Mitigated by Next.js built-in escaping and CSP headers via Nginx.
- **CSRF:** Not applicable for JWT Bearer API pattern (no cookies for API auth).
- **Rate Limiting:**
  - Login: 5 attempts per 15 minutes per IP.
  - OTP request: 3 requests per 10 minutes per phone number.
  - WhatsApp link generation: 30 requests per minute per user.
- **File Upload:**
  - Restrict to JPG/PNG via MIME type check.
  - Max 5MB per file.
  - Store outside web root; serve via authenticated API endpoint.
  - Filename sanitized (UUID + original extension).

### 12.7 Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| API response time (p95) | < 200ms | For standard CRUD operations |
| Dashboard load | < 1s | KPIs aggregated via materialized view or cached query |
| Global search | < 500ms | PostgreSQL trigram + full-text search |
| Image upload | < 3s | For 5MB file on standard VPS bandwidth |
| Concurrent users | 20+ | More than sufficient for single garage |

### 12.8 Deployment & DevOps

**Development Environment:**
- Docker Compose with hot reload for both Next.js and Fastify.
- PostgreSQL 16 container with seeded test data.
- Prisma Studio for database inspection.

**Production Environment:**
- Single VPS (Ubuntu 22.04 LTS).
- Docker Compose with production-optimized builds.
- Nginx reverse proxy with Let's Encrypt SSL.
- PM2 for Node.js process management (alternative: Docker with restart policy).
- Automated daily backup script (`pg_dump` + file upload backup).
- Health check endpoint: `/api/v1/health` returns DB connection status and uptime.

**Backup Strategy:**
- Daily `pg_dump` at 02:00 local time.
- 7-day local retention on VPS.
- Optional: sync to cloud storage (S3-compatible bucket) for off-site redundancy.
- Photo files backed up via `rsync` to secondary location.

### 12.9 Browser & Device Support

- **Desktop:** Latest Chrome, Firefox, Safari, Edge. No Internet Explorer.
- **Mobile:** Chrome (Android), Safari (iOS). Mechanics primarily use mobile/tablet.
- **Responsive breakpoints:**
  - Mobile: < 768px (mechanic primary view)
  - Tablet: 768px – 1024px
  - Desktop: > 1024px (manager primary view)

### 12.10 Mobile Usage Note

Mechanics primarily use the system on phone or tablet to update repair status and log work. The repair detail view, parts assignment, and photo upload must be fully usable on a small screen (touch-optimized, large tap targets, bottom-sheet modals). The manager's heavy operations (calendar, reports, KPIs, employee management) are desktop-first but must remain functional on tablet.

---

## 13. Implementation Roadmap (Suggested)

### Phase 1 — Foundation (Weeks 1–3)
- Project setup: Next.js + Fastify + PostgreSQL + Prisma + Docker
- Authentication system (internal JWT + client OTP)
- Employee management module
- System settings module
- Database schema implementation with all v1 entities

### Phase 2 — Core Operations (Weeks 4–6)
- Car registration and management
- Appointment booking (internal + portal)
- Repair job creation and status workflow
- Mechanic assignment and work logging
- Diagnosis workflow with structured reports

### Phase 3 — Inventory & Financials (Weeks 7–8)
- Parts catalog and stock management
- Stock transactions and low-stock alerts
- Parts assignment to repairs
- Labor item management
- Payment registration and invoice generation

### Phase 4 — Client Experience & Reporting (Weeks 9–10)
- Client portal (cars, status tracking, diagnosis view, invoices)
- WhatsApp template integration (wa.me links)
- Notification log
- End-of-day report generation
- KPI dashboard with charts
- Global search implementation

### Phase 5 — Polish & Deployment (Weeks 11–12)
- Repair photo upload and gallery
- Calendar and planning views
- Performance optimization and indexing
- Security audit and rate limiting
- Production deployment, SSL, backups
- User acceptance testing with garage staff

---

## 14. Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-26 | Product Team | Initial draft |
| 2.0 | 2026-06-26 | Product Team | Final PRD: integrated 10 enhancement proposals, added technical architecture with Node.js + Fastify + PostgreSQL + Next.js stack, added structured labor costs, repair priority, photos, notification log, global search, 6-digit OTP, soft deletes, invoice format, reopening log, and implementation roadmap. |

---

*Document version 2.0 — Sagman Garage Management System*  
*Single-garage deployment — Not for multi-tenant use*
