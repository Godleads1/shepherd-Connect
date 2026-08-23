---
name: PDF & PPTX rendering on classroom TVs
description: pdf.js version/build constraints, PPTX→PDF conversion, and patterns for the TV slides feature
---

# PDF rendering on classroom TVs

- Use **pdfjs-dist v4 LEGACY build** (`pdfjs-dist/legacy/build/pdf.mjs`). Modern builds assume bleeding-edge JS (v6 crashed on `Map.getOrInsertComputed` even in the workspace preview browser); smart-TV browsers are far older.
- **Why:** the TV display page must run on whatever browser the church TVs ship with; legacy build is transpiled for old engines.
- Worker must be loaded via Vite's `?url` import (`import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")`). A bare specifier inside `new URL(..., import.meta.url)` is NOT resolved by Vite and 404s silently — getDocument then fails.
- pdf.js fetches via XHR, so signed GCS URLs fail CORS — PDFs are streamed same-origin through a display-token-authenticated endpoint instead.
- The same-origin file URL is identical for every upload, so it carries a `?v=<hash of objectPath>` version stamp; without it the TV never reloads a replaced PDF. The same `v` tags `media-page` SSE events so a TV ignores page turns meant for a superseded file.
- **Render races:** always keep the pdf.js `RenderTask` and `cancel()` it on effect cleanup — otherwise an old render can finish late and overwrite a newer page on the shared canvas. Ignore `RenderingCancelledException`, log other failures.
- Page-pin writes must be conditional on the current `objectPath` (uploads always get fresh paths) so a stale clicker request can't pin a page on a replacement PDF.

## PPTX support (converted server-side, never rendered directly)

- PowerPoint uploads are converted to PDF on the server with headless LibreOffice (nix package `libreoffice`), then flow through the exact same PDF pipeline. There is no reliable browser-side PPTX renderer.
- Each soffice run needs its **own `-env:UserInstallation` profile dir** — concurrent runs sharing a profile fail on a lock file. Cap concurrent conversions (in-process counter) so a burst can't starve the API.
- Check magic bytes before invoking soffice (`PK` zip for .pptx, OLE `D0CF11E0...` for .ppt) — soffice sometimes exits 0 on garbage without producing output.
- **Slow-conversion race:** any multi-second server-side step before a "set media" write must snapshot the row (kind + objectPath) first and make the final write conditional on it, else a stale conversion overwrites media set meanwhile → return 409.
- Phones may report blank/`application/octet-stream` MIME for PPTX — match on file extension as fallback, and never send an empty Content-Type to the GCS signed-URL PUT.
- Full-screen sizing: slides/images render full-bleed (news ticker overlays them); pdf.js canvas must re-render on window resize or it keeps the size measured at load time.
