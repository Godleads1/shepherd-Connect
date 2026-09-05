---
name: Auth SSE revocation ordering
description: The non-obvious ordering and rollout constraints for revoking authenticated general-user SSE across API instances.
---

General authenticated SSE must share one per-user database ordering boundary with every session, status, or role revocation. The final handshake authorization, initial write, connection registration, and each protected event write belong on the read side of that boundary; revocation belongs on the exclusive side and publishes its invalidation transactionally.

**Why:** A listener alone leaves two subtle races: a protected event can be written after revocation but before the remote notification arrives, and a stream can validate before revocation yet register after the notification already fired. Replit's supported publish-time schema diff also does not guarantee custom trigger/function DDL, so correctness must not depend on a hand-applied notification trigger.

**How to apply:** For general-user realtime changes, preserve the shared/exclusive per-user ordering plus authoritative session-version, status, and effective-role rereads. Emit application-issued PostgreSQL notifications inside the revoking transaction to close idle remote streams promptly, retain listener reconnect and heartbeat fallback, and keep classroom-display realtime isolated.