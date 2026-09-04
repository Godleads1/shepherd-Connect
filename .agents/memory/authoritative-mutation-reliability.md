---
name: Authoritative mutation reliability
description: Reliability rules for domain commands, secondary reconciliation, and races between related writes.
---

Treat the PostgreSQL domain transaction as the sole authority for whether a command succeeded. Build the authoritative response before commit; after commit, refresh, formatting, delivery, and realtime failures must be reported separately and must never reclassify the command as failed.

Related commands that can create contradictory state must serialize on the same domain key. For child-day handover operations, request creation and checkout share one transaction-scoped lock and revalidate eligibility after acquiring it.

**Why:** A checkout could commit and resolve a pickup request while a redundant cleanup call made the UI report failure. Independent request creation could also race checkout and leave a stale active pickup signal.

**How to apply:** For each remediation phase, identify the authoritative transition, keep required response construction in its transaction, make retries return persisted state, separate post-commit reconciliation messaging, and test opposing commands concurrently.