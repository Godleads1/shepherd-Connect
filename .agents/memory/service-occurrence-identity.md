---
name: Service occurrence identity
description: Approved attendance identity and the unresolved pickup/custody boundary for First and Second Service.
---

Attendance occurrences are identified by child, service date, and service slot. First Service and Second Service on the same date are legitimate separate attendance records and must never be merged or treated as duplicates.

Pickup requests and custody episodes remain day-level until a product decision explicitly changes their granularity. When more than one service attendance is simultaneously active, parent pickup creation must report an ambiguity conflict rather than selecting a slot.

**Why:** The product supports both services on one date, but no approved rule says whether pickup/custody is per date, per attendance occurrence, or one continuous both-services episode.

**How to apply:** Preserve `requestedServices` behavior and date-level pickup/custody schemas. Do not add slot-specific pickup wording or identity until the product rule is decided.