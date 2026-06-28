# Sagman — Development Master Plan

> Generated from PRD v2.0 Final — 2026-06-27  
> Stack: Next.js 15 · Fastify · PostgreSQL 16 · Prisma · Docker

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Monorepo Layout](#2-monorepo-layout)
3. [Database Schema (Prisma)](#3-database-schema-prisma)
4. [API Route Map](#4-api-route-map)
5. [Frontend Pages Map](#5-frontend-pages-map)
6. [Phase-by-Phase Tasks](#6-phase-by-phase-tasks)
7. [Component Architecture](#7-component-architecture)
8. [Key Design Decisions](#8-key-design-decisions)

---

## 1. Project Structure

```
sagman/
├── apps/
│   ├── web/          ← Next.js 15 (App Router) frontend
│   └── api/          ← Fastify backend
├── packages/
│   ├── db/           ← Prisma schema + generated client
│   ├── shared/       ← Zod schemas shared between web & api
│   └── config/       ← Shared ESLint, TypeScript configs
├── docker/
│   ├── nginx/        ← Nginx config + SSL
│   └── scripts/      ← Backup scripts (pg_dump, rsync)
├── docker-compose.yml
├── docker-compose.prod.yml
└── PLANNING.md
```

---

## 2. Monorepo Layout

### `apps/web` — Next.js 15

```
apps/web/
├── app/
│   ├── (auth)/
│   │   └── login/              ← Internal login (email + password)
│   ├── (internal)/             ← Layout: sidebar nav, requires JWT
│   │   ├── dashboard/          ← KPI cards, live widgets, alerts
│   │   ├── appointments/       ← List, create, confirm, reschedule
│   │   │   └── [id]/
│   │   ├── repairs/            ← List with filters, status board
│   │   │   └── [id]/           ← Repair detail: full workflow
│   │   ├── cars/               ← Car registry
│   │   │   └── [id]/
│   │   ├── employees/          ← Employee list + form
│   │   ├── stock/              ← Parts catalog + stock levels
│   │   │   └── [id]/
│   │   ├── calendar/           ← Day/Week/Month views
│   │   ├── reports/            ← End-of-day report generator
│   │   ├── search/             ← Global search results
│   │   ├── notifications/      ← Notification log
│   │   └── settings/           ← System settings (manager only)
│   ├── (portal)/               ← Client portal layout
│   │   ├── portal/
│   │   │   ├── page.tsx        ← Public landing page
│   │   │   ├── login/          ← Phone + OTP
│   │   │   ├── cars/           ← My cars list
│   │   │   ├── repairs/[id]/   ← Car repair status timeline
│   │   │   ├── invoices/[id]/  ← Invoice view
│   │   │   └── book/           ← Appointment booking form
│   └── api/                    ← Next.js API routes (BFF proxy layer, if needed)
├── components/
│   ├── ui/                     ← Primitive UI (shadcn/ui based)
│   ├── layout/                 ← Sidebar, TopNav, MobileNav
│   ├── dashboard/              ← KPI cards, charts, widgets
│   ├── repairs/                ← RepairCard, StatusBadge, Timeline
│   ├── appointments/           ← AppointmentForm, CalendarPicker
│   ├── calendar/               ← CalendarView, DayView, WeekView
│   ├── stock/                  ← PartsTable, StockAlert
│   ├── payment/                ← InvoicePreview, PaymentForm
│   └── portal/                 ← ClientStatusCard, OTPInput
├── lib/
│   ├── api-client.ts           ← Typed fetch wrapper for Fastify
│   ├── auth.ts                 ← JWT decode, session helpers
│   ├── whatsapp.ts             ← wa.me URL builder per template
│   └── date.ts                 ← Date helpers, overdue calc
├── middleware.ts               ← Route protection (role-based)
└── public/
    └── uploads/                ← Dev-only photo storage
```

### `apps/api` — Fastify

```
apps/api/
├── src/
│   ├── server.ts               ← Fastify instance + plugins registration
│   ├── plugins/
│   │   ├── auth.ts             ← JWT + OTP middleware
│   │   ├── prisma.ts           ← Prisma client plugin
│   │   ├── multipart.ts        ← File upload (photos)
│   │   └── rate-limit.ts       ← Rate limiting rules
│   ├── routes/
│   │   ├── v1/
│   │   │   ├── auth/
│   │   │   ├── employees/
│   │   │   ├── appointments/
│   │   │   ├── cars/
│   │   │   ├── repairs/
│   │   │   ├── parts/
│   │   │   ├── payments/
│   │   │   ├── dashboard/
│   │   │   ├── reports/
│   │   │   ├── search/
│   │   │   ├── notifications/
│   │   │   ├── settings/
│   │   │   └── portal/
│   ├── services/               ← Business logic layer
│   │   ├── repair.service.ts   ← State machine + overdue logic
│   │   ├── stock.service.ts    ← Stock decrement + alerts
│   │   ├── invoice.service.ts  ← Invoice number generation
│   │   ├── otp.service.ts      ← 6-digit OTP generation
│   │   └── whatsapp.service.ts ← wa.me URL builder + log
│   ├── hooks/
│   │   ├── authorize.ts        ← Role-guard hook factory
│   │   └── validate.ts         ← Zod schema validation hook
│   └── utils/
│       ├── errors.ts           ← Standardized error factory
│       └── pagination.ts       ← Cursor + offset pagination helpers
└── Dockerfile
```

### `packages/db` — Prisma

```
packages/db/
├── schema.prisma
├── migrations/
└── seed.ts                     ← Dev seed: admin user + sample data
```

### `packages/shared` — Zod Schemas

```
packages/shared/
├── schemas/
│   ├── auth.schema.ts
│   ├── appointment.schema.ts
│   ├── repair.schema.ts
│   ├── part.schema.ts
│   ├── payment.schema.ts
│   └── employee.schema.ts
└── types/
    ├── enums.ts                ← RepairStatus, Priority, Role, etc.
    └── api.ts                  ← Shared API response types
```

---

## 3. Database Schema (Prisma)

```prisma
// packages/db/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── ENUMS ────────────────────────────────────────────────

enum Role {
  overseer
  manager
  mechanic
}

enum UserStatus {
  active
  inactive
}

enum AppointmentStatus {
  pending
  confirmed
  rescheduled
  cancelled
  converted
}

enum RepairStatus {
  received
  diagnosing
  awaiting_approval
  in_progress
  waiting_for_parts
  complete
  delivered
  cancelled
}

enum Priority {
  low
  normal
  high
  emergency
}

enum ClientApprovalStatus {
  pending
  approved
  rejected
  bypassed
}

enum StockTransactionType {
  received
  used
  adjustment
}

enum PhotoType {
  before
  during
  after
}

enum PartCategory {
  Engine
  Brakes
  Electrical
  Bodywork
  Suspension
  Other
}

// ─── MODELS ────────────────────────────────────────────────

model User {
  id            String     @id @default(cuid())
  name          String
  email         String     @unique
  passwordHash  String     @map("password_hash")
  role          Role
  phone         String?
  specialty     String?
  status        UserStatus @default(active)
  createdAt     DateTime   @default(now()) @map("created_at")

  // Relations (as actor)
  createdRepairs         RepairJob[]           @relation("CreatedRepairs")
  primaryRepairs         RepairJob[]           @relation("PrimaryMechanic")
  repairMechanics        RepairMechanic[]
  repairWorkLogs         RepairWorkLog[]
  repairStatusLogs       RepairStatusLog[]
  delayReports           DelayReport[]
  stockTransactions      StockTransaction[]
  repairParts            RepairPart[]
  laborItems             LaborItem[]
  payments               Payment[]
  repairPhotos           RepairPhoto[]
  notificationsSent      NotificationLog[]
  appointmentsCreated    Appointment[]

  @@map("users")
}

model Client {
  id           String    @id @default(cuid())
  name         String
  phone        String    @unique
  otpCode      String?   @map("otp_code")
  otpExpiresAt DateTime? @map("otp_expires_at")
  createdAt    DateTime  @default(now()) @map("created_at")

  cars         Car[]
  appointments Appointment[]

  @@map("clients")
}

model Car {
  id         String    @id @default(cuid())
  matricule  String    @unique
  make       String
  model      String
  year       Int?
  color      String?
  vin        String?
  mileage    Int?
  notes      String?
  clientId   String?   @map("client_id")
  deletedAt  DateTime? @map("deleted_at")
  createdAt  DateTime  @default(now()) @map("created_at")

  client     Client?      @relation(fields: [clientId], references: [id])
  repairs    RepairJob[]
  appointments Appointment[]

  @@map("cars")
}

model Appointment {
  id                 String            @id @default(cuid())
  clientId           String?           @map("client_id")
  clientName         String            @map("client_name")
  clientPhone        String            @map("client_phone")
  carId              String?           @map("car_id")
  carMatricule       String?           @map("car_matricule")
  purpose            String
  requestedAt        DateTime          @map("requested_at")
  confirmedAt        DateTime?         @map("confirmed_at")
  rescheduledTo      DateTime?         @map("rescheduled_to")
  status             AppointmentStatus @default(pending)
  cancellationReason String?           @map("cancellation_reason")
  createdById        String            @map("created_by")
  notes              String?
  deletedAt          DateTime?         @map("deleted_at")
  createdAt          DateTime          @default(now()) @map("created_at")

  client    Client?      @relation(fields: [clientId], references: [id])
  car       Car?         @relation(fields: [carId], references: [id])
  createdBy User         @relation(fields: [createdById], references: [id])
  repairJob RepairJob?

  @@map("appointments")
}

model RepairJob {
  id                         String               @id @default(cuid())
  carId                      String               @map("car_id")
  appointmentId              String?              @unique @map("appointment_id")
  createdById                String               @map("created_by")
  primaryMechanicId          String               @map("primary_mechanic_id")
  status                     RepairStatus         @default(received)
  priority                   Priority             @default(normal)
  description                String
  diagnosisReport            Json?                @map("diagnosis_report")
  diagnosisShared            Boolean              @default(false) @map("diagnosis_shared")
  clientApprovalStatus       ClientApprovalStatus @default(pending) @map("client_approval_status")
  clientApprovalBypassReason String?              @map("client_approval_bypass_reason")
  estimatedDurationHours     Float?               @map("estimated_duration_hours")
  estimatedCost              Decimal?             @db.Decimal(10, 2) @map("estimated_cost")
  partsTotal                 Decimal              @default(0) @db.Decimal(10, 2) @map("parts_total")
  laborTotal                 Decimal              @default(0) @db.Decimal(10, 2) @map("labor_total")
  discountAmount             Decimal              @default(0) @db.Decimal(10, 2) @map("discount_amount")
  finalTotal                 Decimal              @default(0) @db.Decimal(10, 2) @map("final_total")
  internalNotes              String?              @map("internal_notes")
  targetCompletionDate       DateTime?            @map("target_completion_date")
  actualCompletionDate       DateTime?            @map("actual_completion_date")
  cancellationReason         String?              @map("cancellation_reason")
  reopenedReason             String?              @map("reopened_reason")
  createdAt                  DateTime             @default(now()) @map("created_at")
  updatedAt                  DateTime             @updatedAt @map("updated_at")

  car            Car               @relation(fields: [carId], references: [id])
  appointment    Appointment?      @relation(fields: [appointmentId], references: [id])
  createdBy      User              @relation("CreatedRepairs", fields: [createdById], references: [id])
  primaryMechanic User             @relation("PrimaryMechanic", fields: [primaryMechanicId], references: [id])
  mechanics      RepairMechanic[]
  statusLogs     RepairStatusLog[]
  workLogs       RepairWorkLog[]
  delayReports   DelayReport[]
  parts          RepairPart[]
  laborItems     LaborItem[]
  payment        Payment?
  photos         RepairPhoto[]
  notifications  NotificationLog[]

  @@index([carId, status])
  @@index([targetCompletionDate])
  @@map("repair_jobs")
}

model RepairMechanic {
  repairId    String   @map("repair_id")
  mechanicId  String   @map("mechanic_id")
  isPrimary   Boolean  @default(false) @map("is_primary")
  assignedAt  DateTime @default(now()) @map("assigned_at")

  repair   RepairJob @relation(fields: [repairId], references: [id])
  mechanic User      @relation(fields: [mechanicId], references: [id])

  @@id([repairId, mechanicId])
  @@map("repair_mechanics")
}

model RepairStatusLog {
  id          String   @id @default(cuid())
  repairId    String   @map("repair_id")
  fromStatus  String?  @map("from_status")
  toStatus    String   @map("to_status")
  changedById String   @map("changed_by")
  note        String?
  createdAt   DateTime @default(now()) @map("created_at")

  repair    RepairJob @relation(fields: [repairId], references: [id])
  changedBy User      @relation(fields: [changedById], references: [id])

  @@map("repair_status_logs")
}

model RepairWorkLog {
  id          String   @id @default(cuid())
  repairId    String   @map("repair_id")
  mechanicId  String   @map("mechanic_id")
  description String
  hoursSpent  Float    @map("hours_spent")
  loggedAt    DateTime @default(now()) @map("logged_at")

  repair   RepairJob @relation(fields: [repairId], references: [id])
  mechanic User      @relation(fields: [mechanicId], references: [id])

  @@map("repair_work_logs")
}

model DelayReport {
  id           String   @id @default(cuid())
  repairId     String   @map("repair_id")
  reportedById String   @map("reported_by")
  reason       String
  evidenceNote String?  @map("evidence_note")
  createdAt    DateTime @default(now()) @map("created_at")

  repair     RepairJob @relation(fields: [repairId], references: [id])
  reportedBy User      @relation(fields: [reportedById], references: [id])

  @@map("delay_reports")
}

model Part {
  id               String       @id @default(cuid())
  name             String
  reference        String?
  category         PartCategory @default(Other)
  compatibleModels String?      @map("compatible_models")
  unitCost         Decimal      @db.Decimal(10, 2) @map("unit_cost")
  quantity         Int          @default(0)
  minThreshold     Int          @default(0) @map("min_threshold")
  supplier         String?
  deletedAt        DateTime?    @map("deleted_at")
  createdAt        DateTime     @default(now()) @map("created_at")
  updatedAt        DateTime     @updatedAt @map("updated_at")

  stockTransactions StockTransaction[]
  repairParts       RepairPart[]

  @@index([quantity, minThreshold])
  @@map("parts")
}

model StockTransaction {
  id              String               @id @default(cuid())
  partId          String               @map("part_id")
  type            StockTransactionType
  quantityChange  Int                  @map("quantity_change")
  quantityAfter   Int                  @map("quantity_after")
  repairId        String?              @map("repair_id")
  doneById        String               @map("done_by")
  note            String?
  createdAt       DateTime             @default(now()) @map("created_at")

  part    Part      @relation(fields: [partId], references: [id])
  doneBy  User      @relation(fields: [doneById], references: [id])

  @@map("stock_transactions")
}

model RepairPart {
  id              String   @id @default(cuid())
  repairId        String   @map("repair_id")
  partId          String   @map("part_id")
  quantityUsed    Int      @map("quantity_used")
  unitCostAtTime  Decimal  @db.Decimal(10, 2) @map("unit_cost_at_time")
  addedById       String   @map("added_by")
  addedAt         DateTime @default(now()) @map("added_at")
  stockOverride   Boolean  @default(false) @map("stock_override")

  repair  RepairJob @relation(fields: [repairId], references: [id])
  part    Part      @relation(fields: [partId], references: [id])
  addedBy User      @relation(fields: [addedById], references: [id])

  @@map("repair_parts")
}

model LaborItem {
  id        String   @id @default(cuid())
  repairId  String   @map("repair_id")
  description String
  cost      Decimal  @db.Decimal(10, 2)
  addedById String   @map("added_by")
  addedAt   DateTime @default(now()) @map("added_at")

  repair  RepairJob @relation(fields: [repairId], references: [id])
  addedBy User      @relation(fields: [addedById], references: [id])

  @@map("labor_items")
}

model Payment {
  id             String   @id @default(cuid())
  repairId       String   @unique @map("repair_id")
  amountBilled   Decimal  @db.Decimal(10, 2) @map("amount_billed")
  amountReceived Decimal  @db.Decimal(10, 2) @map("amount_received")
  changeDue      Decimal  @db.Decimal(10, 2) @map("change_due")
  method         String   @default("cash")
  paidByName     String?  @map("paid_by_name")
  receivedById   String   @map("received_by")
  invoiceNumber  String   @unique @map("invoice_number") // INV-YYYY-XXXXX
  notes          String?
  createdAt      DateTime @default(now()) @map("created_at")

  repair     RepairJob @relation(fields: [repairId], references: [id])
  receivedBy User      @relation(fields: [receivedById], references: [id])

  @@map("payments")
}

model RepairPhoto {
  id          String    @id @default(cuid())
  repairId    String    @map("repair_id")
  uploadedById String   @map("uploaded_by")
  type        PhotoType
  filePath    String    @map("file_path")
  createdAt   DateTime  @default(now()) @map("created_at")

  repair     RepairJob @relation(fields: [repairId], references: [id])
  uploadedBy User      @relation(fields: [uploadedById], references: [id])

  @@map("repair_photos")
}

model NotificationLog {
  id             String   @id @default(cuid())
  type           String   // T-01 through T-06
  recipientPhone String   @map("recipient_phone")
  sentById       String   @map("sent_by")
  messagePreview String   @map("message_preview")
  repairId       String?  @map("repair_id")
  appointmentId  String?  @map("appointment_id")
  sentAt         DateTime @default(now()) @map("sent_at")

  sentBy  User       @relation(fields: [sentById], references: [id])
  repair  RepairJob? @relation(fields: [repairId], references: [id])

  @@index([sentAt])
  @@map("notification_logs")
}

model SystemSettings {
  key       String @id
  value     String

  @@map("system_settings")
}

// Invoice counter for sequential numbering
model InvoiceCounter {
  year    Int @id
  lastSeq Int @default(0) @map("last_seq")

  @@map("invoice_counters")
}
```

---

## 4. API Route Map

All routes prefixed with `/api/v1`

### Auth
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | Public | Email + password → JWT tokens |
| POST | `/auth/refresh` | Public | Refresh access token |
| POST | `/auth/logout` | Any | Invalidate refresh token |
| POST | `/auth/portal/request-otp` | Public | Send OTP to client phone |
| POST | `/auth/portal/verify-otp` | Public | Verify OTP → session |

### Employees
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/employees` | Manager | List all employees |
| POST | `/employees` | Manager | Create employee + user account |
| GET | `/employees/:id` | Manager | Employee detail |
| PATCH | `/employees/:id` | Manager | Update employee info |
| PATCH | `/employees/:id/deactivate` | Manager | Deactivate (never delete) |
| PATCH | `/employees/:id/reset-password` | Manager | Reset password |

### Appointments
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/appointments` | Manager | List with filters (status, date) |
| POST | `/appointments` | Manager | Create (confirmed immediately) |
| GET | `/appointments/:id` | Manager | Detail |
| PATCH | `/appointments/:id` | Manager | Edit |
| PATCH | `/appointments/:id/confirm` | Manager | Confirm pending |
| PATCH | `/appointments/:id/reschedule` | Manager | Reschedule |
| PATCH | `/appointments/:id/cancel` | Manager | Cancel with reason |
| POST | `/appointments/:id/convert` | Manager | Convert to repair job |
| DELETE | `/appointments/:id` | Manager | Soft delete |
| POST | `/portal/appointments` | Client | Book appointment (portal) |

### Cars
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/cars` | Manager | List cars |
| POST | `/cars` | Manager | Register car |
| GET | `/cars/:id` | Manager | Car detail + repair history |
| PATCH | `/cars/:id` | Manager | Update car info |
| DELETE | `/cars/:id` | Manager | Soft delete |
| GET | `/cars/:id/repairs` | Manager | Full repair history for car |

### Repairs
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/repairs` | Manager | List with filters (status, priority, mechanic) |
| POST | `/repairs` | Manager | Create repair job |
| GET | `/repairs/:id` | Manager/Mechanic | Repair detail |
| PATCH | `/repairs/:id` | Manager | Update repair fields |
| PATCH | `/repairs/:id/status` | Manager/Mechanic | Transition status (enforces state machine) |
| PATCH | `/repairs/:id/assign` | Manager | Assign/update mechanics |
| POST | `/repairs/:id/diagnosis` | Manager/Mechanic | Fill/update diagnosis report |
| PATCH | `/repairs/:id/share-diagnosis` | Manager | Set diagnosis_shared = true |
| PATCH | `/repairs/:id/client-approval` | Manager | Record client approval/rejection/bypass |
| POST | `/repairs/:id/delay-report` | Manager | File delay report |
| POST | `/repairs/:id/work-logs` | Manager/Mechanic | Add work log entry |
| GET | `/repairs/:id/work-logs` | Manager/Mechanic | List work logs |
| GET | `/repairs/:id/status-logs` | Manager | Full audit trail |
| POST | `/repairs/:id/parts` | Manager/Mechanic | Assign part from stock |
| DELETE | `/repairs/:id/parts/:repairPartId` | Manager | Remove part assignment |
| POST | `/repairs/:id/labor` | Manager/Mechanic | Add labor item |
| PATCH | `/repairs/:id/labor/:itemId` | Manager | Update labor item |
| DELETE | `/repairs/:id/labor/:itemId` | Manager | Remove labor item |
| POST | `/repairs/:id/photos` | Manager/Mechanic | Upload photo |
| GET | `/repairs/:id/photos` | Manager/Mechanic | List photos |
| DELETE | `/repairs/:id/photos/:photoId` | Manager | Delete photo |
| POST | `/repairs/:id/notify` | Manager | Log WhatsApp send + return wa.me URL |

### Parts & Stock
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/parts` | Manager/Mechanic | List parts catalog (with low-stock filter) |
| POST | `/parts` | Manager | Add part to catalog |
| GET | `/parts/:id` | Manager | Part detail + transaction history |
| PATCH | `/parts/:id` | Manager | Update part details |
| DELETE | `/parts/:id` | Manager | Soft delete part |
| POST | `/parts/:id/stock` | Manager | Add stock (received) |
| POST | `/parts/:id/adjust` | Manager | Manual stock adjustment (requires note) |
| GET | `/parts/:id/transactions` | Manager | Stock transaction history |

### Payments
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/payments` | Manager | Register payment for a Complete repair |
| GET | `/payments/:id` | Manager | Payment + invoice detail |
| GET | `/repairs/:id/invoice` | Manager/Client | Fetch invoice data |

### Dashboard
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/dashboard/summary` | Overseer/Manager | KPI cards (today/week/month) |
| GET | `/dashboard/live` | Manager | Live state widgets (active repairs, overdue, low stock) |
| GET | `/dashboard/mechanic-performance` | Manager | Mechanic table (current month) |
| GET | `/dashboard/revenue-chart` | Manager | Daily revenue for current month |

### Reports
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/reports/end-of-day` | Manager | Auto-generate report content |
| POST | `/reports/end-of-day/send` | Manager | Log WhatsApp send to overseer → return wa.me URL |

### Calendar
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/calendar/day` | Manager/Mechanic | Day view (repairs by mechanic) |
| GET | `/calendar/week` | Manager/Mechanic | Week view |
| GET | `/calendar/month` | Manager | Month view (car count per day) |

### Search
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/search?q=` | Manager | Global search across all entities |

### Notifications
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/notifications` | Manager | Notification log (paginated) |

### Settings
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/settings` | Manager | All system settings |
| PATCH | `/settings` | Manager | Bulk update settings |
| POST | `/settings/logo` | Manager | Upload garage logo |

### Portal (Client-facing)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/portal/me` | Client | Client profile + cars |
| GET | `/portal/cars` | Client | My cars list |
| GET | `/portal/repairs/:id` | Client | Repair status + timeline (own cars only) |
| GET | `/portal/invoices/:id` | Client | Invoice (own repairs only) |
| POST | `/portal/appointments` | Client | Book appointment |
| GET | `/portal/appointments` | Client | My pending appointments |

### Health
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/health` | Public | DB status + uptime |

---

## 5. Frontend Pages Map

### Internal System

| Route | Role | Component | Description |
|-------|------|-----------|-------------|
| `/login` | Public | `LoginPage` | Email + password form |
| `/dashboard` | Overseer/Manager | `DashboardPage` | KPI cards + live widgets |
| `/appointments` | Manager | `AppointmentsPage` | Table with status filters |
| `/appointments/new` | Manager | `AppointmentFormPage` | Create appointment |
| `/appointments/[id]` | Manager | `AppointmentDetailPage` | Detail + actions |
| `/repairs` | Manager | `RepairsPage` | Board/table view + filters |
| `/repairs/new` | Manager | `RepairFormPage` | Create repair job |
| `/repairs/[id]` | Manager/Mechanic | `RepairDetailPage` | Full workflow page |
| `/cars` | Manager | `CarsPage` | Car registry list |
| `/cars/new` | Manager | `CarFormPage` | Register car |
| `/cars/[id]` | Manager | `CarDetailPage` | Car + history |
| `/employees` | Manager | `EmployeesPage` | Employee list |
| `/employees/new` | Manager | `EmployeeFormPage` | Create employee |
| `/employees/[id]` | Manager | `EmployeeDetailPage` | Detail + deactivate |
| `/stock` | Manager/Mechanic | `StockPage` | Parts catalog + stock levels |
| `/stock/new` | Manager | `PartFormPage` | Add part to catalog |
| `/stock/[id]` | Manager | `PartDetailPage` | Part + transactions |
| `/calendar` | Manager/Mechanic | `CalendarPage` | Day/Week/Month views |
| `/reports` | Manager | `ReportsPage` | End-of-day report generator |
| `/search` | Manager | `SearchPage` | Global search results |
| `/notifications` | Manager | `NotificationsPage` | WhatsApp notification log |
| `/settings` | Manager | `SettingsPage` | System settings form |

### Client Portal

| Route | Role | Component | Description |
|-------|------|-----------|-------------|
| `/portal` | Public | `PortalLandingPage` | Landing: garage info + Book CTA |
| `/portal/login` | Public | `PortalLoginPage` | Phone + OTP form |
| `/portal/cars` | Client | `PortalCarsPage` | My vehicles |
| `/portal/repairs/[id]` | Client | `PortalRepairPage` | Status timeline + diagnosis |
| `/portal/invoices/[id]` | Client | `PortalInvoicePage` | Invoice view |
| `/portal/book` | Client | `PortalBookPage` | Appointment booking form |

---

## 6. Phase-by-Phase Tasks

### Phase 1 — Foundation (Weeks 1–3)

#### 1.1 Repository & Infrastructure
- [ ] Initialize pnpm monorepo with `apps/web`, `apps/api`, `packages/db`, `packages/shared`, `packages/config`
- [ ] Configure `tsconfig.json` (base, web, api) with path aliases
- [ ] Configure shared ESLint + Prettier
- [ ] Write `docker-compose.yml` (Next.js + Fastify + PostgreSQL + Redis optional)
- [ ] Write `docker-compose.prod.yml` (production-optimized)
- [ ] Configure Nginx config with SSL termination + reverse proxy
- [ ] Write `.env.example` for all apps
- [ ] Set up `packages/db`: Prisma schema (all 17 models) + first migration
- [ ] Write dev seed script (`packages/db/seed.ts`): default Manager user, SystemSettings defaults

#### 1.2 Fastify API Setup
- [ ] Bootstrap Fastify server with TypeScript
- [ ] Register plugins: `@fastify/jwt`, `@fastify/cors`, `@fastify/multipart`, `@fastify/rate-limit`
- [ ] Prisma plugin (singleton client, graceful shutdown)
- [ ] Standardized error handler (returns `{ error: { code, message, statusCode } }`)
- [ ] Health check endpoint: `/api/v1/health`
- [ ] Role-guard hook factory (`authorize(roles: Role[])`)
- [ ] Request logging with Pino

#### 1.3 Authentication
- [ ] `POST /api/v1/auth/login` — bcrypt verify + issue access/refresh JWT pair
- [ ] `POST /api/v1/auth/refresh` — validate refresh token + issue new access token
- [ ] `POST /api/v1/auth/logout` — clear refresh token (DB or Redis)
- [ ] JWT middleware: decode token, attach `req.user` with role
- [ ] Rate limiting: 5 login attempts per 15 min per IP
- [ ] Client OTP: `POST /api/v1/auth/portal/request-otp` (6-digit, 10 min TTL, `crypto.randomInt`)
- [ ] Client OTP: `POST /api/v1/auth/portal/verify-otp` → 7-day session token
- [ ] OTP rate limiting: 3 requests per 10 min per phone
- [ ] Next.js middleware: protect `/dashboard/*`, `/portal/*` routes by role

#### 1.4 Next.js Setup
- [ ] Bootstrap Next.js 15 App Router with TypeScript
- [ ] Configure Tailwind CSS + shadcn/ui component library
- [ ] `lib/api-client.ts`: typed fetch wrapper with JWT attachment + error parsing
- [ ] `middleware.ts`: route protection (redirect based on role + auth state)
- [ ] `components/layout/`: Sidebar, TopNav, MobileNav, PageWrapper
- [ ] Login page (`/login`): form → POST `/auth/login` → store tokens → redirect
- [ ] Auth context / server-side session helpers

#### 1.5 Employee Management
- [ ] API: full CRUD routes for employees (GET list, POST create, GET detail, PATCH update, PATCH deactivate, PATCH reset-password)
- [ ] Business rule: block deactivating last Manager
- [ ] Business rule: employees never deleted, only deactivated
- [ ] Frontend: `/employees` list page with status badges
- [ ] Frontend: `/employees/new` + `/employees/[id]` form with role selector
- [ ] Frontend: deactivate confirmation modal

#### 1.6 System Settings
- [ ] API: `GET /settings` and `PATCH /settings` (key-value store)
- [ ] API: `POST /settings/logo` (file upload, store in `/uploads/logo`)
- [ ] Seed default settings on first run
- [ ] Frontend: `/settings` page — form for all configurable settings
- [ ] Frontend: logo upload component

---

### Phase 2 — Core Operations (Weeks 4–6)

#### 2.1 Car Management
- [ ] API: full CRUD + soft delete for cars
- [ ] API: `GET /cars/:id/repairs` — paginated repair history
- [ ] Business rule: no two active repairs for same car (validate on create repair)
- [ ] Matricule uniqueness: case-insensitive index
- [ ] Frontend: `/cars` list with search by matricule/make
- [ ] Frontend: `/cars/new` — intake form
- [ ] Frontend: `/cars/[id]` — detail with repair history timeline

#### 2.2 Appointment Management
- [ ] API: full appointment CRUD
- [ ] API: `PATCH /appointments/:id/confirm` — check capacity limit (BR-012)
- [ ] API: `PATCH /appointments/:id/reschedule`
- [ ] API: `PATCH /appointments/:id/cancel` — requires reason
- [ ] API: `POST /appointments/:id/convert` — create RepairJob, set status = converted, pre-fill data
- [ ] Capacity check: query count of confirmed appointments on target date vs `max_concurrent_cars` setting
- [ ] Soft delete support
- [ ] Frontend: `/appointments` — table with status filter tabs
- [ ] Frontend: `/appointments/new` — form (client lookup / free-text)
- [ ] Frontend: `/appointments/[id]` — detail with action buttons (Confirm / Reschedule / Cancel / Convert)
- [ ] Frontend: capacity warning modal on confirm

#### 2.3 Repair Management — Core
- [ ] API: `POST /repairs` — create repair job (validate: car has no active repair)
- [ ] API: `GET /repairs` — list with filters: status, priority, mechanic, date range
- [ ] API: `GET /repairs/:id` — full repair detail (mechanics, parts, labor, logs)
- [ ] API: `PATCH /repairs/:id/status` — state machine enforcement:
  - Validate allowed transitions (see Section 8 of PRD)
  - Overdue check: if overdue, require delay report before any transition
  - Complete → In Progress: require `reopened_reason` (Manager only)
  - Transition to Complete: set `actual_completion_date`
  - Create `RepairStatusLog` entry on every transition
- [ ] API: `PATCH /repairs/:id/assign` — update mechanic assignments
- [ ] Business rule BR-001: cannot move to In Progress without mechanic
- [ ] Business rule BR-020: one must be primary
- [ ] Overdue flag: computed field `isOverdue` based on `target_completion_date`, current status, and `waiting_for_parts` time exclusion
- [ ] Frontend: `/repairs` — board view (columns by status) + list view toggle
- [ ] Frontend: `/repairs/new` — form with mechanic assignment, priority, target date
- [ ] Frontend: `/repairs/[id]` — master detail page:
  - Status badge + transition buttons (role-gated)
  - Overdue indicator (red banner)
  - Mechanic assignment panel
  - Work log entries (add + list)
  - Status history timeline

#### 2.4 Diagnosis Workflow
- [ ] API: `POST /repairs/:id/diagnosis` — save/update diagnosis JSON (issue list, recommendations, parts required, labor items, cost estimate)
- [ ] API: `PATCH /repairs/:id/share-diagnosis` — set `diagnosis_shared = true`, change status to `awaiting_approval`
- [ ] API: `PATCH /repairs/:id/client-approval` — record approved/rejected/bypassed (bypass requires reason, Manager only)
- [ ] Optional gate: `require_diagnosis_approval` system setting
- [ ] Frontend: diagnosis form panel inside `/repairs/[id]`:
  - Issue list (add/remove rows: description + severity dropdown)
  - Recommended repairs textarea
  - Parts required picker (from catalog)
  - Labor items (add/remove rows: description + cost)
  - Auto-calculated cost estimate
- [ ] Frontend: "Share with Client" button → confirm modal
- [ ] Frontend: Client approval status badge + approve/reject/bypass actions

#### 2.5 Work Logs & Delay Reports
- [ ] API: `POST /repairs/:id/work-logs` — mechanic logs work entry
- [ ] API: `GET /repairs/:id/work-logs`
- [ ] API: `POST /repairs/:id/delay-report` — Manager files delay report (blocks status transition if overdue)
- [ ] Frontend: work log section on repair detail (add form + expandable list)
- [ ] Frontend: delay report modal (required before any status change when overdue)

---

### Phase 3 — Inventory & Financials (Weeks 7–8)

#### 3.1 Parts Catalog & Stock
- [ ] API: parts CRUD + soft delete
- [ ] API: `POST /parts/:id/stock` — add received stock (creates `StockTransaction` type=received)
- [ ] API: `POST /parts/:id/adjust` — manual adjustment (requires note, type=adjustment)
- [ ] API: `GET /parts/:id/transactions` — transaction history
- [ ] Low-stock query: `WHERE quantity <= min_threshold AND deleted_at IS NULL`
- [ ] Frontend: `/stock` — parts table with category filter, low-stock highlighting
- [ ] Frontend: `/stock/new` + `/stock/[id]` — part form
- [ ] Frontend: stock transaction history panel
- [ ] Frontend: "Add Stock" and "Adjust" modals

#### 3.2 Parts Assignment to Repairs
- [ ] API: `POST /repairs/:id/parts` — assign part to repair:
  - Validate stock > 0 OR Manager override
  - Decrement `Part.quantity`
  - Create `StockTransaction` type=used
  - Create `RepairPart` with `unit_cost_at_time` (snapshot)
  - Recalculate `RepairJob.parts_total` and `final_total`
  - Log override if applicable (BR-003)
- [ ] API: `DELETE /repairs/:id/parts/:repairPartId` — remove part (restore stock)
- [ ] Frontend: parts assignment section on repair detail:
  - Search/select part from catalog
  - Quantity input
  - Stock level shown inline
  - Override warning for zero-stock
  - Parts table with subtotals

#### 3.3 Labor Items
- [ ] API: `POST /repairs/:id/labor` — add labor item (description + cost)
- [ ] API: `PATCH /repairs/:id/labor/:itemId` — update
- [ ] API: `DELETE /repairs/:id/labor/:itemId` — remove
- [ ] Auto-recalculate `RepairJob.labor_total` and `final_total` on change
- [ ] Frontend: labor items section on repair detail (inline editable table)

#### 3.4 Payment & Invoice
- [ ] Invoice counter service: atomic increment with `InvoiceCounter` table per year
- [ ] Invoice number format: `INV-YYYY-XXXXX` (zero-padded 5 digits)
- [ ] API: `POST /payments` — register payment:
  - Validate status = complete
  - Calculate `change_due = amount_received - amount_billed`
  - Generate invoice number
  - Create `Payment` record (immutable)
  - Payment record is immutable after creation (BR-013 context)
- [ ] API: `GET /repairs/:id/invoice` — return structured invoice data
- [ ] Invoice PDF/print: browser print-optimized invoice page at `/repairs/[id]/invoice`
- [ ] Frontend: payment form on repair detail (visible when status = Complete)
- [ ] Frontend: invoice preview page (printable, styled)
- [ ] WhatsApp T-05 button: opens `wa.me` link with invoice message

---

### Phase 4 — Client Experience & Reporting (Weeks 9–10)

#### 4.1 Client Portal
- [ ] Portal landing page: garage info from SystemSettings, "Book an Appointment" CTA
- [ ] OTP login flow: phone input → request OTP → 6-digit input → verify → session
- [ ] `GET /portal/me` — client profile + cars
- [ ] Portal cars page: list client's vehicles
- [ ] Portal repair page: status timeline (RepairStatusLog), estimated completion, diagnosis (if shared), photos
- [ ] Portal invoice page: read-only invoice view
- [ ] Portal appointment booking: car select/enter, issue description, date picker (available days only)
- [ ] Data isolation: all portal queries filter by `client_id` from session token (BR-011)

#### 4.2 WhatsApp Integration
- [ ] `lib/whatsapp.ts` (shared): template builders for T-01 through T-06
  - T-01: Appointment Confirmation
  - T-02: Appointment Rescheduled
  - T-03: Diagnosis Results
  - T-04: Car Ready for Pickup
  - T-05: Invoice
  - T-06: End-of-Day Report
- [ ] Each template builder: interpolate data → URL-encode → return `https://wa.me/{phone}?text={msg}`
- [ ] API: `POST /repairs/:id/notify` — build wa.me URL + create `NotificationLog` entry → return URL to frontend
- [ ] Frontend: "Send via WhatsApp" buttons throughout the UI (repair detail, appointments, reports)
- [ ] Phone E.164 validation on all entry points

#### 4.3 Notification Log
- [ ] API: `GET /notifications` — paginated list with filters (type, date range)
- [ ] Frontend: `/notifications` page — table with template code, recipient, preview, timestamp

#### 4.4 End-of-Day Report
- [ ] API: `GET /reports/end-of-day` — auto-aggregate:
  - Cars received today (repairs created today)
  - Cars delivered today + revenue sum
  - Total revenue today
  - Active repairs: count + per-car status breakdown
  - Overdue repairs with delay reasons
  - Low stock alerts
- [ ] API: `POST /reports/end-of-day/send` — Manager adds free notes, log + return T-06 wa.me URL
- [ ] Frontend: `/reports` — report preview with editable notes field → Send to Overseer button

#### 4.5 KPI Dashboard
- [ ] API: `GET /dashboard/summary?period=today|week|month` — aggregate KPIs:
  - Total revenue
  - Cars received / delivered
  - Avg repair duration
  - On-time completion rate
  - Delayed repairs count
- [ ] API: `GET /dashboard/live` — real-time widgets:
  - Active repairs by status breakdown
  - Overdue repairs list
  - Low stock parts
  - Pending appointments count
  - High/Emergency repairs list
- [ ] API: `GET /dashboard/mechanic-performance` — current month table
- [ ] API: `GET /dashboard/revenue-chart` — daily revenue array for current month
- [ ] Frontend: `/dashboard` — period toggle (Today/Week/Month), KPI cards, bar chart (Recharts/Chart.js), live widgets, mechanic table
- [ ] Dashboard alert banners: Low stock, Overdue repairs, High/Emergency priority

#### 4.6 Global Search
- [ ] PostgreSQL trigram indexes: `Car.matricule`, `Client.name`, `Client.phone`
- [ ] Full-text search on `RepairJob` description
- [ ] API: `GET /search?q=` — query across: cars (matricule), clients (name, phone), repairs (id), payments (invoice_number)
- [ ] Results grouped by entity type
- [ ] Target: < 500ms for up to 10,000 records
- [ ] Frontend: search bar in TopNav → results dropdown → navigate to detail

---

### Phase 5 — Polish & Deployment (Weeks 11–12)

#### 5.1 Repair Photos
- [ ] API: `POST /repairs/:id/photos` — multipart upload:
  - Validate MIME type (JPG/PNG)
  - Max 5MB
  - Sanitize filename (UUID + extension)
  - Store outside web root: `/var/uploads/repairs/{repair_id}/`
  - Serve via authenticated endpoint
- [ ] API: `GET /repairs/:id/photos`
- [ ] API: `DELETE /repairs/:id/photos/:photoId`
- [ ] API: `GET /uploads/:filePath` — authenticated file serving
- [ ] Frontend: photo upload section on repair detail (before/during/after tabs)
- [ ] Frontend: photo gallery with lightbox
- [ ] Portal: client sees photos when repair linked to their car

#### 5.2 Calendar
- [ ] API: `GET /calendar/day?date=` — repairs active on day, grouped by mechanic
- [ ] API: `GET /calendar/week?startDate=` — repairs + appointments for week
- [ ] API: `GET /calendar/month?month=&year=` — car count per day
- [ ] Frontend: `/calendar` — three views (Day/Week/Month)
  - Color-coded by status (see PRD section 5.11)
  - Priority badge for High/Emergency
  - Click to navigate to repair detail
  - Manager: reschedule target date from calendar (requires note)
  - Mechanic workload view (active repairs per mechanic per day)

#### 5.3 Performance Optimization
- [ ] Add all required DB indexes (see PRD section 12.5)
- [ ] Trigram indexes for search (`pg_trgm` extension)
- [ ] GIN index on `diagnosis_report` JSONB
- [ ] Verify p95 API response < 200ms with realistic data
- [ ] Verify global search < 500ms
- [ ] Verify dashboard load < 1s (consider materialized view for KPIs)

#### 5.4 Security Audit
- [ ] bcrypt cost factor 12 for all passwords
- [ ] All routes properly guarded by role
- [ ] File upload: MIME type + extension validation
- [ ] Photos served only via authenticated endpoint
- [ ] Rate limiting applied: login (5/15min/IP), OTP (3/10min/phone), WhatsApp (30/min/user)
- [ ] JWT expiry and refresh rotation tested
- [ ] Data isolation: mechanic can only access assigned repairs; client only own data

#### 5.5 Production Deployment
- [ ] Write `Dockerfile` for `apps/api` and `apps/web`
- [ ] Write production `docker-compose.prod.yml`
- [ ] Nginx config: SSL via Let's Encrypt, static asset caching, rate limiting
- [ ] Backup script: `pg_dump` at 02:00 local, 7-day retention
- [ ] Photo backup: `rsync` to secondary location
- [ ] Health check: `/api/v1/health` returns DB status + uptime
- [ ] PM2 config or Docker restart policy
- [ ] Test full deployment on VPS (Ubuntu 22.04 LTS, 2vCPU, 4GB RAM)

#### 5.6 UAT (User Acceptance Testing)
- [ ] Walkthrough all 31 business rules (BR-001 through BR-031)
- [ ] Test state machine: all valid and invalid transitions
- [ ] Test overdue flow: overdue flag → delay report → status unblocked
- [ ] Test capacity warning on appointment confirm
- [ ] Test low-stock override logging
- [ ] Test invoice number sequencing across year boundary
- [ ] Test data isolation: client cannot see other clients' data
- [ ] Test deactivation of last Manager is blocked
- [ ] Mobile/tablet test: mechanic repair detail page
- [ ] WhatsApp templates: verify wa.me URLs open correctly with correct content

---

## 7. Component Architecture

### Repair Detail Page (most complex — `/repairs/[id]`)

```
RepairDetailPage
├── RepairHeader
│   ├── StatusBadge (color-coded)
│   ├── PriorityBadge (High/Emergency indicator)
│   ├── OverdueBanner (red, conditional)
│   └── ActionMenu (transition buttons, role-gated)
├── RepairInfoPanel
│   ├── CarInfoCard (make, model, matricule, linked client)
│   ├── MechanicAssignmentPanel
│   └── DatesPanel (target, actual, estimated duration)
├── DiagnosisPanel
│   ├── IssueList (editable rows: description + severity)
│   ├── RecommendationsTextarea
│   ├── ShareDiagnosisButton
│   └── ClientApprovalWidget
├── PartsPanel
│   ├── PartSearchSelector
│   ├── AssignedPartsTable (with unit cost snapshot)
│   └── PartsTotal
├── LaborPanel
│   ├── LaborItemsTable (inline editable)
│   └── LaborTotal
├── CostSummaryPanel
│   ├── Parts Total / Labor Total / Discount / Final Total
│   └── EstimatedCostBadge
├── PaymentPanel (visible when status = Complete)
│   ├── PaymentForm
│   └── InvoicePreviewButton
├── WorkLogsPanel
│   ├── WorkLogForm (mechanic: what + hours)
│   └── WorkLogList (timeline)
├── StatusHistoryPanel
│   └── StatusAuditTrail (immutable timeline)
├── PhotosPanel
│   ├── PhotoUploadZone (before/during/after tabs)
│   └── PhotoGallery
└── WhatsAppActionsPanel
    ├── SendDiagnosisButton (T-03)
    ├── SendReadyButton (T-04, when Complete)
    └── SendInvoiceButton (T-05, after payment)
```

### Status State Machine (enforced server-side)

```
Allowed Transitions Map:
{
  received:          [diagnosing, cancelled],
  diagnosing:        [awaiting_approval, in_progress, cancelled],
  awaiting_approval: [in_progress, cancelled],
  in_progress:       [waiting_for_parts, complete, cancelled],
  waiting_for_parts: [in_progress, cancelled],
  complete:          [delivered, in_progress],  ← in_progress requires reopened_reason + Manager
  delivered:         [],  ← TERMINAL
  cancelled:         [],  ← TERMINAL
}
```

---

## 8. Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Monorepo tool | pnpm workspaces | Lightweight, fast, native workspace support |
| UI components | shadcn/ui + Tailwind | Accessible, unstyled primitives, easy to customize |
| Charts | Recharts | React-native, responsive, good SSR support |
| Calendar | React Big Calendar or custom | Mechanic day view + manager week/month needs |
| Photos | Local FS (v1) | Simple, no external dependency; migrate to S3 later |
| OTP storage | PostgreSQL (`otp_code` + `otp_expires_at` on Client) | No Redis dependency in v1 (Redis optional) |
| JWT storage | Memory + httpOnly cookie for refresh | XSS-safe for refresh; access in memory |
| Invoice counter | `InvoiceCounter` table per year | Atomic increment, no race condition |
| Overdue calculation | Server-side computed per request | Simple, always accurate |
| WhatsApp | `wa.me` link generation (no API) | No API approval needed; manager controls send |
| Diagnosis data | JSONB in PostgreSQL | Flexible schema for issue list, supports GIN index |
| Parts cost snapshot | `unit_cost_at_time` on RepairPart | Historical accuracy, immune to catalog price changes |
| Soft delete | `deleted_at` on Car, Part, Appointment | Preserves historical associations |
| Password reset | Manager-only | v1 simplicity; no email service required |

---

## Next Steps (Start Here)

1. **Initialize the monorepo** — pnpm workspaces, Docker Compose, shared configs
2. **Implement Prisma schema** — all 17 models + initial migration + seed
3. **Authentication first** — JWT (internal) + OTP (portal) before any feature work
4. **Follow Phase 1 → 5 order strictly** — each phase builds on the previous

The critical path is: Auth → Car/Appointment → Repair state machine → Parts/Payment → Portal/Dashboard → Calendar/Search → Deployment.
