---
name: GitHub authentication status
description: Integration status alone does not establish that Git pushes are authenticated.
---

Do not treat a healthy GitHub integration status or successful remote listing as proof of authenticated write access.

**Why:** The integration reported healthy and automatic CLI authentication, yet a clean-snapshot push failed with invalid credentials. The authorization prompt also rejected the connection identifier, so repeating that prompt did not resolve access.

On 2026-11-06 a plain fast-forward `git push origin main` through the `github.replit.internal` proxy remote succeeded, and a re-fetch confirmed it, so the earlier failure is not a permanent block.

**How to apply:** Confirm an actual push succeeds before reporting an upload. If Git rejects authentication and the inline recovery flow cannot open, consult current Replit documentation for account-level Connected Services recovery. Do not request tokens in chat or upload the unfiltered project history as a workaround.
