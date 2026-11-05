---
name: Meeting attendance separation
description: Rules for the staff-meeting QR attendance feature and how it must stay independent of Sunday attendance.
---

Meeting attendance must never touch Sunday attendance data (staff_scans, clock records, Sunday reports). Teacher activation is per meeting, not an account flag.

**Why:** the user asked for meeting attendance "separate from Sunday attendance"; admins activate only selected teachers per meeting and download that meeting's report.

**How to apply:**
- Keep scan status codes distinct: 403 means the user isn't an activated teacher for the meeting, 409 means the code is closed, replaced, or outside its window. The teacher UI chooses its error message from the status code.
- Modules imported by app.ts must not dereference Drizzle table objects at load time. api.smoke.test mocks @workspace/db with only usersTable, so a top-level `table.col` reference breaks that suite.
- Opening a QR link while already on /meeting-attendance only changes the #fragment, so the route must listen for hashchange; on-mount capture alone misses repeat scans.
