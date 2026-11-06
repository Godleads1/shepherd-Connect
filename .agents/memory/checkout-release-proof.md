---
name: Checkout release proof
description: Rules for server-verified child release (family QR, helper code, admin override) and how clients must send proof.
---
Every child release (attendance checkout and custody pickup) must carry server-verified proof: the parent's family QR for the child's family, or an unexpired, parent-approved helper code for that child. Only Admin/Super Admin may instead send an override reason; Support never can (user ruling, Nov 2026).

**Why:** the user required the server to refuse release without proof that the collector is authorised; client screens are not trusted.

**How to apply:**
- Never add a checkout path that skips proof; a face match is not proof.
- Audit every release as `child_released` with the method only — never store the QR or helper code (also not in sessionStorage; proof stays in memory and staff re-verify after a reload).
- A replay of an already-committed operation may omit proof.
- Helper-code lookup (`verify-otp`) is staff-only.
- Known open findings left unchanged by user choice: WhatsApp delegate release, and Support being able to approve a helper code then check out.
