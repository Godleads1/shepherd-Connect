---
name: Classroom TV list (playlist)
description: User rulings for the per-class TV list of videos, files and Bible passages, and how it relates to the TV's current media.
---
Teachers build a per-class TV list; adding an item never changes the TV, and Play copies the item into the class's current TV media (user ruling, Nov 2026: "just add to list", lists clear automatically each new day, 30 items max).

**Why:** the user wanted teachers to queue several videos/slides/verses/documents and jump back to earlier ones by pressing Play.

**How to apply:**
- Keep the TV itself reading only the current-media row; the list is a staff-side source, so TV/PDF clicker/Bible remote need no list awareness.
- Play always restarts an item (PDF auto-play, Bible at first verse, unblanked); resuming mid-item was explicitly deferred.
- Lists are scoped to the Lagos service date; older days are hidden and purged lazily on add — no cron.
- Removing or reordering items must never clear or change what the TV shows.
