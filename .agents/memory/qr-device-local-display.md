---
name: Attendance QR device-local display
description: How meeting and Sunday QR codes stay visible until their time ends without the server storing the plaintext code.
---
Meeting and Sunday QR codes stay visible only on the device that issued them (browser localStorage), until the meeting ends or until midnight Lagos time after the service date. The server returns only a short non-secret code ID (16-char prefix of the stored hash, admin-only responses) so a device hides its saved code once the code is replaced, closed or revoked anywhere.

**Why:** the user chose "same device only" over storing a recoverable code on the server; the hash-only token rule stays intact.

**How to apply:** never add server-side plaintext/encrypted token storage without asking. A code-ID mismatch hides the saved code but must not delete it (stale query data could erase a newer code from another tab). Saved codes are cleared on sign-out in the shared session cleanup.
