import { Router, type Request, type Response } from "express";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import {
  BIBLE_ID_RE,
  CHAPTER_ID_RE,
  BibleServiceError,
  getBibleChapter,
  getBibleVersion,
  isBibleConfigured,
  listBibleBooks,
  listBibleVersions,
} from "../services/bibleText";

/**
 * Read-only Bible browsing for staff choosing a passage to project on a
 * classroom TV. Proxies API.Bible so the API key stays on the server.
 */
const router = Router();

// Staff who can control a classroom TV (teachers are further limited to their
// own classes when they actually put a passage on a TV).
const BIBLE_ROLES = ["teacher", "super_admin", "admin", "support", "attendant"];

function wrap(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response) => {
    try {
      await handler(req, res);
    } catch (error) {
      if (error instanceof BibleServiceError) {
        res.status(error.statusCode).json({ error: "Bible service", message: error.message });
        return;
      }
      req.log.error({ err: error }, "Bible request failed");
      if (!res.headersSent) res.status(500).json({ error: "Internal server error", message: "Bible text is unavailable right now." });
    }
  };
}

async function requireAllowedBible(bibleId: string) {
  if (!BIBLE_ID_RE.test(bibleId)) throw new BibleServiceError(400, "Invalid Bible version");
  const version = await getBibleVersion(bibleId);
  if (!version) throw new BibleServiceError(404, "That Bible version isn't available");
  return version;
}

router.get("/bible/versions", authMiddleware, requireRoles(...BIBLE_ROLES), wrap(async (_req, res) => {
  if (!isBibleConfigured()) {
    res.json({ configured: false, versions: [] });
    return;
  }
  res.json({ configured: true, versions: await listBibleVersions() });
}));

router.get("/bible/:bibleId/books", authMiddleware, requireRoles(...BIBLE_ROLES), wrap(async (req, res) => {
  const bibleId = String(req.params.bibleId);
  await requireAllowedBible(bibleId);
  res.json({ books: await listBibleBooks(bibleId) });
}));

router.get("/bible/:bibleId/chapters/:chapterId", authMiddleware, requireRoles(...BIBLE_ROLES), wrap(async (req, res) => {
  const bibleId = String(req.params.bibleId);
  const chapterId = String(req.params.chapterId);
  if (!CHAPTER_ID_RE.test(chapterId)) throw new BibleServiceError(400, "Invalid chapter");
  const version = await requireAllowedBible(bibleId);
  const chapter = await getBibleChapter(bibleId, chapterId);
  res.json({ ...chapter, version: version.abbreviation });
}));

export default router;
