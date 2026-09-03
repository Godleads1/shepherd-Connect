---
name: Phase 6 attendance and custody rulings
description: Human-approved authority, custody, QR, WhatsApp, and compatibility rules for Phase 6.
---

Phase 6 uses service-specific staff scans as the authoritative staff-attendance source. First and Second Service remain separate; Both Services means both service records.

Child service presence belongs to attendance, while physical custody belongs to a separate per-child custody episode. Successful support acceptance immediately creates `in_class` attendance without teacher confirmation. Continuous Both Services attendance links two service rows to one custody episode; pickup and later return requires a new episode.

Normal checkout belongs only to the accepting support worker. Admin override requires a bounded reason, preserves the original custodian, and is audited. Support-to-support custody transfer is not part of Phase 6.

Staff and handover QR tokens must be opaque, purpose-bound, revocable, lifecycle-bounded, and must never establish the acting user's identity. WhatsApp uses verified canonical E.164 identity; release-sensitive actions require action-bound, short-lived, non-replayable step-up proof.

Legacy escort/arrival paths remain temporary compatibility routes but are not part of the normal workflow and must use the canonical transition service.

Audit logs, including report-download events, are retained indefinitely until an authorized deletion. No time-based cleanup job or inferred numeric retention period should be added.

**Why:** These rulings resolve the human decisions from the Phase 6 architecture review while preserving the Phase 1–5 security and concurrency guarantees.

**How to apply:** Treat these authority boundaries as invariants in attendance, custody, QR, WhatsApp, reporting, and legacy-route work. Stop for human review before weakening or replacing any of them.