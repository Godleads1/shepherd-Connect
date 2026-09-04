---
name: Authoritative mutation reliability
description: Reliability rules for domain commands, secondary reconciliation, and races between related writes.
---

Treat the PostgreSQL domain transaction as the sole authority for whether a command succeeded. Build the authoritative response before commit; after commit, refresh, formatting, delivery, and realtime failures must be reported separately and must never reclassify the command as failed.

Related commands that can create contradictory state must serialize on the same domain key. For child-day handover operations, request creation and checkout share one transaction-scoped lock and revalidate eligibility after acquiring it.

For checkout commands, one client-generated operation identity represents one logical attempt across retries, response loss, reconciliation, and reloads. Ambiguous transport outcomes remain unknown until actor-bound reconciliation; a locked not-found result retains the identity for a safe retry. Durable replay snapshots contain only command-authoritative fields, never enriched child, family, medical, photo, or biometric data.

**Why:** A checkout could commit and resolve a pickup request while a redundant cleanup call made the UI report failure. Independent request creation could also race checkout and leave a stale active pickup signal. Replacing an identity after response loss can repeat effects, while storing enriched responses unnecessarily duplicates sensitive data.

**How to apply:** For each remediation phase, identify the authoritative transition, keep required response construction in its transaction, make retries return persisted state, separate post-commit reconciliation messaging, and test opposing commands concurrently. Lock operation identity before domain locks, bind replay to actor and resource without enumeration, and keep stored results minimal.