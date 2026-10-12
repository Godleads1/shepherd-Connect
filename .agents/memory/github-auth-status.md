---
name: GitHub authentication status
description: Integration status alone does not establish that Git pushes are authenticated.
---

Do not treat a healthy GitHub integration status or successful remote listing as proof of authenticated write access.

**Why:** The integration reported healthy and automatic CLI authentication, yet a clean-snapshot push failed with invalid credentials. The authorization prompt also rejected the connection identifier, so repeating that prompt did not resolve access.

**How to apply:** Confirm an actual push succeeds before reporting an upload. If Git rejects authentication and the inline recovery flow cannot open, consult current Replit documentation for account-level Connected Services recovery. Do not request tokens in chat or upload the unfiltered project history as a workaround.
