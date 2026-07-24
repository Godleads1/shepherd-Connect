---
name: Cloud Run trust proxy + pg pool error
description: Two production-only bugs that cause health check 500s on Cloud Run autoscale deployments.
---

# Cloud Run: trust proxy + pg pool error handler

## Rule
Any Express app deployed to Cloud Run (autoscale) must have BOTH:
1. `app.set("trust proxy", 1)` — before all middleware, especially `express-rate-limit`
2. `pool.on("error", (err) => console.error(...))` — on every `pg.Pool` instance

## Why
**express-rate-limit v8** throws a `ValidationError` with code `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` when `X-Forwarded-For` is present but Express's `trust proxy` is `false`. Cloud Run **always** injects `X-Forwarded-For` on every request (including health check probes). Without `trust proxy`, the validation error returns 500 on every probe → health check fails → promote step fails → build fails.

**pg Pool** with `min > 0` establishes minimum connections at startup. If a connection is dropped or fails, the pool emits an `'error'` event. Without a listener, Node.js crashes the process (unhandled event). Cloud Run then restarts the container, causing crash-loops and intermittent health check failures.

## How to apply
- In `app.ts` (or wherever Express app is created): add `app.set("trust proxy", 1)` as the very first line after `const app = express()`.
- In `lib/db/src/index.ts`: add `pool.on("error", (err) => console.error("pg pool error:", err.message))` right after pool creation.
- These two bugs produce *no symptoms in dev* because dev has no proxy headers and database is always reachable.
