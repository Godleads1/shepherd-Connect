---
name: DB test notification cleanup
description: Prevent development database test fixtures from surviving because notification side effects reference synthetic users.
---

Database-backed suites that create active admin or parent identities must treat those identities as possible notification recipients, including notifications created by another suite or a live development worker.

**Why:** Synthetic users can remain after otherwise successful tests when recipient outbox rows or in-app projections still reference them. Domain-only cleanup is insufficient because recipient selection crosses domain boundaries.

**How to apply:** Before deleting synthetic users, remove outbox rows addressed to those users, then their in-app notification projections and other fixture-owned rows. End integration gates with a zero-residue query for known synthetic identity patterns.