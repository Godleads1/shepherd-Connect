---
name: Bible projection licensing (API.Bible)
description: Licence rules and plan limits that constrain the classroom TV Bible verse feature.
---
- Text comes from API.Bible (key in secret API_BIBLE_KEY; optional env BIBLE_VERSIONS allow-list, default NIV,NKJV,NLT,AMP,KJV).
- Licence rules we must keep: show the copyright line with the Scripture, show the version abbreviation right after the quoted text, never alter the text, refresh cached text within 30 days, and send a FUMS report (fums.api.bible/f3 image beacon) every time a verse is shown — on the TV and on the phone preview.
- Free Starter plan = non-commercial use only and at most 3 copyrighted versions per key; KJV is open access. The user chose AMP/NLT/NKJV/NIV, so one must be dropped unless they upgrade.

**Why:** the church uses it free/non-commercially; breaking these terms risks the key being revoked mid-service.
**How to apply:** any change to the TV verse view or caching must keep copyright + abbreviation + FUMS; the chapter JSON verse parsing (attrs.verseId) was written from docs and should be re-checked against a live key.
