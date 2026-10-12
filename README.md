# Shepherd Connect

**Safe. Known. Celebrated.**

Shepherd Connect is a mobile-first children's church management platform. It helps ministry teams manage families, classes, attendance, child pickup, and communication with parents.

## Features

- Family and child records, with parent-facing access.
- Class assignments, teacher allocation, and attendance tracking.
- Check-in and custody-aware pickup workflows with role-based permissions.
- Parent pickup delegates and verification workflows.
- Staff and parent notifications, messaging, and feedback.
- Emergency reporting, administrative reports, and audit records.
- Classroom displays and supporting user-guide presentations.
- Progressive Web App support.

Access depends on the user's role and the operation being performed. A visible page does not grant permission to release a child; the API enforces custody and authorization rules.

## Technology

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, TanStack Query, Wouter
- **Backend:** Node.js, Express 5, TypeScript
- **Database:** PostgreSQL with Drizzle ORM
- **API contracts:** OpenAPI, Orval-generated client hooks, Zod validation
- **Workspace:** pnpm monorepo
- **Tests:** Vitest

## Repository layout

```text
artifacts/
  shepherd-connect/   Main web application
  api-server/         Express API
  parent-guide/       Parent guide
  teacher-guide/      Teacher guide
  support-guide/      Support guide
  superadmin-guide/   Super admin guide
  investor-pitch/     Investor presentation
  mockup-sandbox/     Design previews
lib/
  db/                 Database schema and connection
  api-spec/           OpenAPI specification and code generation
  api-client-react/   Shared API client and React hooks
  api-zod/            API validation schemas
  object-storage-web/ Shared upload utilities
scripts/              Development and maintenance utilities
```

## Development setup

### Prerequisites

- Node.js 24
- pnpm
- A dedicated development PostgreSQL database

```bash
git clone https://github.com/Godleads1/shepherd-Connect.git
cd shepherd-Connect
pnpm install
```

### Configuration

Configure environment variables through your environment's secret manager or shell. Never commit credentials.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection for the intended environment |
| `SESSION_SECRET` | Secret used to sign authentication tokens |
| `PORT` | Listening port for each service; use a different port per service |
| `BASE_PATH` | Frontend base path; defaults to `/` |

Email, phone/WhatsApp verification, web push, AI features, and file storage require their corresponding provider configuration. These services are not provisioned by cloning the repository.

For a **new, disposable development database only**, review the schema and apply it with:

```bash
pnpm --filter @workspace/db run push
```

Do not run schema-changing or seed commands against production without reviewing the changes and taking appropriate backups.

### Start the application

With the database and session secret configured, run each service in its own terminal:

```bash
# API
PORT=8080 pnpm --filter @workspace/api-server run dev
```

```bash
# Web application
PORT=21734 pnpm --filter @workspace/shepherd-connect run dev
```

The frontend expects same-origin API routing. In the configured Replit workspace, use the application's managed workflows and preview routing. Outside that environment, configure a reverse proxy to send `/api` requests to the API service and web requests to Vite. Starting the two servers alone does not configure that proxy.

## Checks

```bash
pnpm run typecheck
pnpm run test
pnpm run build
```

Database-backed checks require a development database:

```bash
pnpm run test:db:development
```

When changing the OpenAPI contract, regenerate the shared client and validators:

```bash
pnpm --filter @workspace/api-spec run codegen
```

## Security and contributions

This application handles children's and families' information. Use synthetic data for development, preserve authorization and custody checks, and keep private records, credentials, and exports out of commits.

Keep changes focused, add regression tests for behavior changes, and run the relevant checks before proposing a pull request. Report security issues privately to the repository owner rather than posting sensitive details in a public issue.

See [`replit.md`](replit.md) for additional workspace notes. Confirm operational details against the current implementation before changing production configuration.
