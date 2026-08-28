---
name: Shell PostgreSQL sidecar gap
description: Environment-specific database validation limitation for shell-run Node tests.
---

Drizzle Kit schema preview/application and managed development database queries can succeed while shell-run Node PostgreSQL tests still fail with `ECONNREFUSED` at `127.0.0.1:5432`.

**Why:** The schema tool and managed database path can reach development PostgreSQL through platform-managed access that is not necessarily available to ordinary shell Node processes.

**How to apply:** Never report opt-in shell database tests as passed when this occurs. Use strict Drizzle preview for schema safety and managed development API/DB evidence where possible, while preserving the shell failure explicitly in the final validation report.