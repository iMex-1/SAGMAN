# Sagman — Garage Management System

> Single-garage automotive workshop management system  
> Stack: Next.js 15 · Fastify v5 · PostgreSQL 16 · Prisma · Docker · TypeScript

---

## Quick Start (Development)

### Prerequisites
- Node.js >= 20
- pnpm >= 9 (`npm install -g pnpm`)
- Docker + Docker Compose

### 1. Clone & install dependencies
```bash
pnpm install
```

### 2. Start infrastructure (PostgreSQL + Redis)
```bash
docker compose up -d
```

### 3. Configure environment
```bash
# API env (already pre-filled for dev)
cat apps/api/.env

# Database env (already pre-filled for dev)
cat packages/db/.env
```

### 4. Run database migration + seed
```bash
# Run migration
cd packages/db
DATABASE_URL="postgresql://sagman:sagman_dev_pass@localhost:5432/sagman_dev" npx prisma migrate dev --name init
cd ../..

# Seed default data
pnpm db:seed
```

### 5. Start the API server (terminal 1)
```bash
pnpm dev:api
# → http://localhost:4000
```

### 6. Start the web frontend (terminal 2)
```bash
pnpm dev:web
# → http://localhost:3000
```

### 7. Open the app
- **Internal System**: http://localhost:3000/login
- **Default Manager**: `admin@sagman.garage` / `Admin@2024`
- **Default Mechanic**: `ahmed@sagman.garage` / `Mechanic@2024`
- **Client Portal**: http://localhost:3000/portal
- **API Health**: http://localhost:4000/api/v1/health
- **Prisma Studio**: `pnpm db:studio`

---

## Project Structure

```
sagman/
├── apps/
│   ├── web/          ← Next.js 15 frontend (port 3000)
│   └── api/          ← Fastify backend (port 4000)
├── packages/
│   ├── db/           ← Prisma schema + client + seed
│   ├── shared/       ← Zod schemas + shared types
│   └── config/       ← Shared TypeScript configs
├── docker/
│   ├── nginx/        ← Production Nginx config
│   └── scripts/      ← Backup scripts
├── docker-compose.yml      ← Dev: postgres + redis only
└── docker-compose.prod.yml ← Production: full stack
```

---

## Useful Commands

| Command | Description |
|---------|-------------|
| `pnpm dev:api` | Start Fastify in dev mode (hot-reload) |
| `pnpm dev:web` | Start Next.js in dev mode |
| `pnpm db:migrate:dev` | Create and apply new migration |
| `pnpm db:seed` | Seed default data |
| `pnpm db:studio` | Open Prisma Studio GUI |
| `pnpm db:reset` | Reset database (drops + re-migrates + seeds) |
| `pnpm typecheck` | Run TypeScript checks across all packages |
| `pnpm build:api` | Build API for production |
| `pnpm build:web` | Build web for production |

---

## Production Deployment

```bash
# 1. Copy env file and fill all production values
cp .env.example .env

# 2. Build and start full stack
docker compose -f docker-compose.prod.yml up -d

# 3. Run migrations (first deploy only)
docker exec sagman_api npx prisma migrate deploy

# 4. Seed (first deploy only)
docker exec sagman_api node dist/seed.js
```

---

## Default Credentials

| User | Email | Password | Role |
|------|-------|----------|------|
| Admin Manager | admin@sagman.garage | Admin@2024 | manager |
| Ahmed Mechanic | ahmed@sagman.garage | Mechanic@2024 | mechanic |

> ⚠️ Change these passwords immediately in production via the employee management UI.

---

## Implementation Status

### ✅ Phase 1 — Foundation (Complete)
- [x] Monorepo setup (pnpm workspaces)
- [x] Docker Compose (dev + production)
- [x] Prisma schema — all 19 models + 9 enums
- [x] Database migration + seed
- [x] Fastify API server (v5) with all plugins
- [x] JWT authentication (access + refresh tokens)
- [x] Client portal OTP authentication (6-digit, 10-min TTL)
- [x] Employee management (CRUD + activate/deactivate + password reset)
- [x] Business rules BR-009, BR-010 (last manager protection)
- [x] System settings (GET + PATCH)
- [x] WhatsApp templates T-01 to T-05 (wa.me URL builder)
- [x] OTP service (cryptographically secure)
- [x] Next.js 15 frontend with App Router
- [x] Login page + JWT session management
- [x] Internal layout (sidebar + topnav)
- [x] Employee management pages (list + create + detail/edit)
- [x] Settings page
- [x] Client portal landing page (placeholder)
- [x] shadcn/ui component library (button, input, card, badge, select, dialog, toast)
- [x] Role-based route protection (middleware)

### 🔲 Phase 2 — Core Operations (Next)
- [ ] Car management (CRUD + history)
- [ ] Appointment management (create + confirm + reschedule + cancel + convert)
- [ ] Repair job creation + state machine enforcement
- [ ] Mechanic assignment + work logging
- [ ] Diagnosis workflow

### 🔲 Phase 3 — Inventory & Financials
- [ ] Parts catalog + stock management
- [ ] Parts assignment to repairs (with cost snapshot)
- [ ] Labor items
- [ ] Payment registration + invoice generation

### 🔲 Phase 4 — Client Experience & Reporting
- [ ] Client portal (cars, status, diagnosis, invoices)
- [ ] WhatsApp notification buttons (all 6 templates)
- [ ] End-of-day report generator
- [ ] KPI dashboard (charts + widgets)
- [ ] Global search

### 🔲 Phase 5 — Polish & Deployment
- [ ] Repair photo upload + gallery
- [ ] Calendar views (day/week/month)
- [ ] Performance optimization + indexes
- [ ] SSL + production deployment
