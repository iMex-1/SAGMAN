# SAGMAN — Session Summary

## Objective
Add car image upload when clients book an appointment, display that image on internal and portal repair detail pages.

## Completed

### Car Image Upload on Appointment Booking
- Migration `002_add_car_image_to_appointments.sql`: `ALTER TABLE appointments ADD COLUMN car_image_url TEXT`
- `POST /portal/upload-car-image` — uploads to R2 bucket `sagman-uploads` under `appointment-cars/`
- `POST /portal/appointments` — stores `carImageUrl` field
- Portal booking form (`portal/book/page.tsx`) — file input with preview, uploads image before submitting

### Car Image on Repair Detail Pages
- Backend: `GET /repairs/:id` now queries `car_image_url` from linked appointment and returns `appointment.carImageUrl`
- Backend: `GET /portal/repairs/:id` now queries `car_image_url` from linked appointment and returns `carImageUrl`
- Internal repair detail (`repairs/[id]/page.tsx`) — `CarClientCard` shows image at top of card, with `onError` fallback
- Portal repair detail (`portal/repairs/[id]/page.tsx`) — car header card shows image instead of icon, with `onError` fallback

### Arabic/Darija Translation of All Forms
- Added placeholder explanations in Moroccan Darija (e.g., "بلاصة الاسم: أحمد بنعلي", "بلاصة النمرة: +212...")
- Converted **all hardcoded French pages** to use `useTranslations` from `next-intl`:
  - Employees: new + detail/edit (form, delete dialog)
  - Cars: new + detail (notes, repair history, delete)
  - Stock: new + detail (add/adjust dialogs, transactions)
  - Repairs: new + invoice
  - Appointments: new + detail (reschedule/cancel/convert dialogs)
  - Client detail, search, calendar (day/month names)
  - Portal booking page, portal landing page (testimonials)
  - Repair detail (SMS/WhatsApp templates, work logs)
- Arabic labels + French labels stored in `messages/ar.json` and `messages/fr.json`

### Fixes & Cleanup
- Serve route: `c.newResponse()` for CORS, `*` wildcard + manual path extraction (not `:key+` or `c.req.param('*')`)
- Employee image rendering: `onError` fallback to initials
- Employee detail: removed email, added CIN/address fields
- Removed "Sécurité" section → soft-delete button (`PATCH /employees/:id/delete`)
- Sidebar: no "Nouvelle réparation" button
- Cars page: no "Enregistrer un véhicule" button
- Appointments page: no "Nouveau rendez-vous", default filter `pending`, date filter input added
- Dashboard: expenses (from stock purchases) + net profit KPIs added; "Durée moyenne" KPI removed

## Deployed
- Worker API: `sagman-api` at `https://sagman-api.moukeddar236med.workers.dev`
- Frontend: `sagman-frontend` at `https://sagman-frontend.moukeddar236med.workers.dev`
