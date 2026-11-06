---
name: Classroom display credentials
description: Security model and revocation semantics for shared classroom pickup screens.
---

Shared classroom screens must use a non-expiring, revocable, read-only credential scoped to one class. Never place a normal staff JWT or full staff session on a shared TV or in its URL.

**Expiration policy:** The user explicitly requested deactivation of screen display link expiration. Existing and new links remain valid until revoked or replaced; historical expiry timestamps are not authorization boundaries.

The TV keeps its link in localStorage (not sessionStorage), so browser restarts/power cycles do not end the session; only revoke or a newly issued link does. The user asked (2026-11-06) that no TV session ever expires, and confirmed one active TV per class: issuing a new link still signs out the previous TV.

**Why:** The user wants screens to keep working without renewing links. Preserve class isolation and revocation rather than restoring automatic expiry.

**Why:** The classroom display intentionally works without an interactive staff login, but it shows sensitive live pickup information. A normal staff token would expose broader APIs and remain usable if copied from the shared device.

**How to apply:** Display issuance, stream registration, pickup delivery, rotation, and revocation must share one class-level ordering mechanism. Every delivered event must still be authorized at delivery time so revocation works across multiple API instances.

Class identity must be canonical (DB id) end-to-end: credentials are issued per DB class id, so any route that resolves a class from a URL number must try the DB id before falling back to the "Class N" display name. Name-first resolution silently invalidates every credential for classes whose DB id doesn't match their name number — the TV just shows "access required" with no other symptom.

TV media (videos/images set remotely by staff) reaches the display as short-lived signed storage URLs over the same authorized SSE stream — never as user-authenticated API paths, since the TV holds only a display token.