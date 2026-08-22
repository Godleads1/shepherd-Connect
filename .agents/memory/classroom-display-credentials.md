---
name: Classroom display credentials
description: Security model and revocation semantics for shared classroom pickup screens.
---

Shared classroom screens must use a short-lived, revocable, read-only credential scoped to one class. Never place a normal staff JWT or full staff session on a shared TV or in its URL.

**Why:** The classroom display intentionally works without an interactive staff login, but it shows sensitive live pickup information. A normal staff token would expose broader APIs and remain usable if copied from the shared device.

**How to apply:** Display issuance, stream registration, pickup delivery, rotation, and revocation must share one class-level ordering mechanism. Every delivered event must still be authorized at delivery time so revocation works across multiple API instances.