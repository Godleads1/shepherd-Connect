---
name: Phase 6 attendance and custody rulings
description: Human-approved authority, custody, QR, WhatsApp, and compatibility rules for Phase 6.
---

Phase 6 uses service-specific staff scans as the authoritative staff-attendance source. First and Second Service remain separate; Both Services means both service records.

Child service presence belongs to attendance, while physical custody belongs to a separate per-child custody episode. Successful support acceptance immediately creates `in_class` attendance without teacher confirmation. Continuous Both Services attendance links two service rows to one custody episode; pickup and later return requires a new episode.

Normal checkout may be done by any support worker (user ruling, 2026-11-06, replacing "accepting support worker only"); the episode keeps the accepting custodian and pickedUpBy records who released. Admin override still requires a bounded reason, preserves the original custodian, and is audited.

Support accepts children only after scanning the parent's family QR (pending list is view-only). If the parent hasn't started a drop-off, support picks children + service and accepts in one step. The class TV "child is coming" alert and the teachers' "Child Coming to Class" WhatsApp both fire only after acceptance, never while the drop-off is merely requested (user ruling, 2026-11-06).

Staff and handover QR tokens must be opaque, purpose-bound, revocable, lifecycle-bounded, and must never establish the acting user's identity. WhatsApp uses verified canonical E.164 identity; release-sensitive actions require action-bound, short-lived, non-replayable step-up proof.

Legacy escort/arrival paths remain temporary compatibility routes but are not part of the normal workflow and must use the canonical transition service.

Audit logs, including report-download events, are retained indefinitely until an authorized deletion. No time-based cleanup job or inferred numeric retention period should be added.

Parents may receive only a separately authored, admin-approved emergency status and instructions for children they currently own. Internal staff reports, notes, evidence, reporter identity, and other families' data remain private.

**Why:** These rulings resolve the human decisions from the Phase 6 architecture review while preserving the Phase 1–5 security and concurrency guarantees.

**How to apply:** Treat these authority boundaries as invariants in attendance, custody, QR, WhatsApp, reporting, and legacy-route work. Stop for human review before weakening or replacing any of them.