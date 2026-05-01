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

- **super_admin** — Full access including user management
- **admin** — Command centre, families, classes, teachers, emergencies
- **teacher** — My class, attendance, appraisals
- **attendant** — Check-in and check-out kiosks
- **parent** — My family, my children, delegates, feedback, notifications

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
  api-server/         Express 5 API (JWT auth, all 17 route domains)
  shepherd-connect/   React + Vite frontend (21 pages)
  mockup-sandbox/     Design canvas server

lib/
  api-spec/           OpenAPI 3.1 spec (2600+ lines, 50+ endpoints)
  api-zod/            Generated Zod validators from OpenAPI
  api-client-react/   Generated TanStack Query hooks + custom-fetch
  db/                 Drizzle ORM schema (14 tables) + drizzle-kit config

scripts/
  src/seed.ts         Database seed script
```

## Database Tables (14)

`users`, `families`, `children`, `classes`, `class_assignments`, `teachers`, `teacher_allocations`, `attendance`, `pickup_delegates`, `notifications`, `parent_feedback`, `child_appraisals`, `emergencies`, `audit_logs`

## Frontend Pages (21)

`/login`, `/register`, `/dashboard`, `/families`, `/families/:id`, `/children`, `/children/:id`, `/classes`, `/class-assignments`, `/checkin`, `/checkout`, `/teachers`, `/teacher-allocations`, `/attendance`, `/pickup-delegates`, `/notifications`, `/feedback`, `/appraisals`, `/emergencies`, `/audit`, `/users`

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
