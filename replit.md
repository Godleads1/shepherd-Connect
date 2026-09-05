# Shepherd Connect — Children's Church Management Platform

## Overview

Full-stack, mobile-first church children's ministry platform with 6 user roles and 8 functional modules. Built as a pnpm monorepo.

**Brand:** Deep Royal Blue `#1e3a8a` · Warm Gold `#f59e0b` · Inter font
**Tagline:** Safe. Known. Celebrated.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Frontend**: React + Vite + Wouter + TanStack Query + Tailwind CSS
- **Auth**: JWT (localStorage) with RBAC
- **Charts**: Recharts

## Artifacts

| Artifact | Port | Path | Description |
|---|---|---|---|
| api-server | 8080 | /api | Express 5 REST API |
| shepherd-connect | 21734 | / | React frontend |
| mockup-sandbox | 8081 | /__mockup | Design canvas |

## User Roles

- **super_admin** — Full access including user management + approvals
- **admin** — Command centre, families, classes, teachers, emergencies, reports
- **teacher** — My class, attendance, appraisals, class change requests
- **attendant** — Check-in and check-out kiosks (incl. OTP delegate checkout)
- **parent** — My family, my children, delegates (OTP), feedback, notifications, profile

## Demo Accounts (seeded)

| Role | Email | Password |
|---|---|---|
| Super Admin | superadmin@shepherd.com | admin123 |
| Admin | admin@shepherd.com | admin123 |
| Teacher | teacher1@shepherd.com | teacher123 |
| Attendant | attendant@shepherd.com | attend123 |
| Parent | parent1@shepherd.com | parent123 |

## Key Commands

```bash
# Install all dependencies
pnpm install

# Push database schema
pnpm --filter @workspace/db run push

# Seed database with demo data
pnpm --filter @workspace/scripts run seed

# Regenerate API types and hooks from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Full typecheck
pnpm run typecheck
```

## Architecture

```
artifacts/
  api-server/         Express 5 API (JWT auth, all 19 route domains)
  shepherd-connect/   React + Vite frontend (24 pages)
  mockup-sandbox/     Design canvas server

lib/
  api-spec/           OpenAPI 3.1 spec (3100+ lines, 60+ endpoints)
  api-zod/            Generated Zod validators from OpenAPI
  api-client-react/   Generated TanStack Query hooks + custom-fetch
  db/                 Drizzle ORM schema (15 tables) + drizzle-kit config

scripts/
  src/seed.ts         Database seed script
```

## Database Tables (15)

`users`, `families`, `children`, `classes`, `class_assignments`, `teachers`, `teacher_allocations`, `attendance`, `pickup_delegates`, `notifications`, `parent_feedback`, `child_appraisals`, `emergencies`, `audit_logs`, `class_change_requests`

## Frontend Pages (24)

`/login`, `/register`, `/dashboard`, `/families`, `/families/:id`, `/children`, `/children/:id`, `/classes`, `/class-assignments`, `/checkin`, `/checkout`, `/teachers`, `/teacher-allocations`, `/attendance`, `/pickup-delegates`, `/notifications`, `/feedback`, `/appraisals`, `/emergencies`, `/audit`, `/users`, `/my-family`, `/reports`, `/class-change-requests`, `/profile`

## API Conventions

- All routes under `/api` prefix
- JWT via `Authorization: Bearer <token>` header
- `setAuthTokenGetter` in `lib/api-client-react/src/custom-fetch.ts` reads from `localStorage.getItem("token")`
- Express 5: use `/{*splat}` for wildcards, always `Promise<void>` on async handlers
- Never `console.log` — use `req.log` (pino-http) or `logger` singleton
- Input/output validation with `@workspace/api-zod` schemas
- Numeric DB fields (feedback ratings) return as strings from Drizzle — cast to Number before responding

## Orval Codegen Fix

The orval codegen had a duplicate export bug. Fix: in `lib/api-spec/orval.config.ts`, the zod output config has no `schemas` key. The codegen script in `lib/api-spec/package.json` appends `export * from "./generated/api";` to override stale barrel exports in `lib/api-zod/src/index.ts`.

## Key Features Implemented

### Attendance, Pickup, and Custody Identity
- Attendance occurrence: child + service date + service slot (`7am` First Service or `10:30am` Second Service)
- Pickup request: child + service date; the missing slot is intentional, not lost data
- Custody episode: child + service date + `requestedServices` release scope (`first`, `second`, or `both`)
- Checkout notifications name the authoritative attendance occurrence; a date-level pickup request never claims its own slot
- If both attendance occurrences are active and a pickup command does not identify an occurrence, staff-assistance conflict handling applies rather than guessing

### Admin Approval Workflow
- Admin/teacher self-signup → `status=pending_approval`, blocked from login until approved
- Super admin sees "Pending Approval" tab on Users page with approve/reject buttons
- Approved users get `status=active`, `isActive=true`

### OTP Delegate Pickup
- Parent adds delegate → backend generates 6-digit OTP (valid 24h)
- OTP shown once to parent (with copy button)
- Attendant uses "Delegate OTP Checkout" tab on Check Out page to verify OTP and release child

### Reports & Export
- Not-picked-up report (live, with parent phone numbers)
- Teacher-to-child ratio monitoring (alerts if under-staffed)
- Attendance CSV export (date range filterable)
- Emergency log CSV export
- Daily summary card (checked in, still present, picked up)

### Class Change Requests
- Parents/teachers submit requests with reason
- Admins review and approve (auto-moves child to new class) or reject
- Pending/resolved tabs, admin notes support

### User Profiles
- Profile completeness progress bar
- Edit name, DOB, gender, phone, place of work, photo URL
- Communication preferences (in-app, WhatsApp, SMS toggle)
- Profile accessible from header avatar

### Add Child Flow (Parents)
- "Add Child" button on My Family page
- Modal with name, DOB, gender, class selection, allergies, medical notes
- Allergy alerts displayed on child cards

### Broadcast Notifications
- Admin can broadcast to specific roles
- Pre-dismissal notification to all parents of currently checked-in children
