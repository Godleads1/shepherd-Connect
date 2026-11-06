import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  classesTable,
  classDisplayMediaTable,
  classDisplayPlaylistItemsTable,
  type ClassDisplayPlaylistItem,
} from "@workspace/db/schema";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";
import { canAccessClass } from "../lib/childAccess";
import { serviceDateAt } from "../lib/serviceTime";
import { notifyClassRefresh } from "../services/classroomDisplayAlerts";
import {
  BIBLE_NO_FIELDS,
  resolveDisplayMediaInput,
  type DisplayMediaInputBody,
} from "../services/classDisplayMediaInput";

/**
 * A class's TV list for the current service day. Adding never changes the TV;
 * Play copies an item into class_display_media (what the TV shows now), so the
 * TV, PDF clicker and Bible remote work exactly as for directly-set media.
 * Lists are scoped to the service date, so they clear each new day.
 */

const router = Router();

export const MAX_PLAYLIST_ITEMS = 30;
// Advisory lock namespace for list edits (68431 is the TV media lock).
const PLAYLIST_LOCK = 68432;
const TV_MEDIA_LOCK = 68431;

export const classDisplayPlaylistDependencies = {
  /** Best-effort YouTube title lookup; null when unavailable. */
  fetchYouTubeTitle: async (videoId: string): Promise<string | null> => {
    try {
      const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (!response.ok) return null;
      const data = await response.json() as { title?: unknown };
      return typeof data.title === "string" && data.title.trim() ? data.title.trim().slice(0, 200) : null;
    } catch {
      return null;
    }
  },
};

type MediaRow = typeof classDisplayMediaTable.$inferSelect;

/** True when the TV is showing this item's content (a later edit may have moved the verse/page). */
function isOnTv(item: ClassDisplayPlaylistItem, media: MediaRow | undefined): boolean {
  if (!media || media.kind !== item.kind) return false;
  if (item.kind === "youtube") return media.youtubeVideoId === item.youtubeVideoId;
  if (item.kind === "file") return media.objectPath === item.objectPath;
  if (item.kind === "bible") {
    return media.bibleId === item.bibleId
      && media.bibleChapterId === item.bibleChapterId
      && media.bibleVerseStart === item.bibleVerseStart
      && media.bibleVerseEnd === item.bibleVerseEnd;
  }
  return false;
}

function toClientItem(item: ClassDisplayPlaylistItem, media: MediaRow | undefined) {
  return {
    id: item.id,
    kind: item.kind,
    label: item.label,
    youtubeVideoId: item.youtubeVideoId,
    fileName: item.fileName,
    contentType: item.contentType,
    pdfPageCount: item.pdfPageCount,
    bibleVersion: item.bibleVersion,
    onTv: isOnTv(item, media),
    createdAt: item.createdAt,
  };
}

/** Validates the class ID and the caller's access; sends the error and returns null on failure. */
async function authorizeClass(req: Request, res: Response): Promise<number | null> {
  const classId = Number(req.params.classId);
  if (!Number.isInteger(classId) || classId <= 0) {
    res.status(400).json({ error: "Bad request", message: "Invalid class ID" });
    return null;
  }
  if (!(await canAccessClass(req.user!, classId, serviceDateAt()))) {
    res.status(403).json({ error: "Forbidden", message: "You are not assigned to this class" });
    return null;
  }
  return classId;
}

function parseItemId(req: Request, res: Response): number | null {
  const itemId = Number(req.params.itemId);
  if (!Number.isInteger(itemId) || itemId <= 0) {
    res.status(400).json({ error: "Bad request", message: "Invalid item ID" });
    return null;
  }
  return itemId;
}

async function readPlaylist(classId: number, serviceDate: string) {
  const [items, [media]] = await Promise.all([
    db.select().from(classDisplayPlaylistItemsTable)
      .where(and(
        eq(classDisplayPlaylistItemsTable.classId, classId),
        eq(classDisplayPlaylistItemsTable.serviceDate, serviceDate),
      ))
      .orderBy(asc(classDisplayPlaylistItemsTable.position), asc(classDisplayPlaylistItemsTable.id)),
    db.select().from(classDisplayMediaTable).where(eq(classDisplayMediaTable.classId, classId)).limit(1),
  ]);
  return { items: items.map(item => toClientItem(item, media)), limit: MAX_PLAYLIST_ITEMS };
}

router.get("/pickup-requests/display-media/:classId/playlist", authMiddleware, async (req, res): Promise<void> => {
  const classId = await authorizeClass(req, res);
  if (classId === null) return;
  res.json(await readPlaylist(classId, serviceDateAt()));
});

router.post("/pickup-requests/display-media/:classId/playlist", authMiddleware, async (req, res): Promise<void> => {
  const classId = await authorizeClass(req, res);
  if (classId === null) return;
  const [cls] = await db.select({ id: classesTable.id })
    .from(classesTable).where(eq(classesTable.id, classId)).limit(1);
  if (!cls) {
    res.status(404).json({ error: "Not found", message: "Class not found" });
    return;
  }
  const serviceDate = serviceDateAt();
  const countToday = async () => (await db.select({ n: sql<number>`count(*)::int` })
    .from(classDisplayPlaylistItemsTable)
    .where(and(
      eq(classDisplayPlaylistItemsTable.classId, classId),
      eq(classDisplayPlaylistItemsTable.serviceDate, serviceDate),
    )))[0].n;
  const fullMessage = `This class's TV list is full (${MAX_PLAYLIST_ITEMS} items). Remove an item first.`;
  // Cheap early check so a full list doesn't trigger an upload conversion.
  if (await countToday() >= MAX_PLAYLIST_ITEMS) {
    res.status(409).json({ error: "Conflict", message: fullMessage });
    return;
  }

  const resolved = await resolveDisplayMediaInput({
    classId,
    user: req.user!,
    body: (req.body ?? {}) as DisplayMediaInputBody,
    log: req.log,
  });
  if (!resolved.ok) {
    res.status(resolved.status).json(resolved.body);
    return;
  }
  const { values } = resolved;
  let label = resolved.label;
  if (values.kind === "youtube") {
    const title = await classDisplayPlaylistDependencies.fetchYouTubeTitle(values.youtubeVideoId!);
    if (title) label = title;
  }

  const added = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(${PLAYLIST_LOCK}, ${classId})`);
    // Earlier days' lists are no longer shown; purge them here.
    await tx.delete(classDisplayPlaylistItemsTable).where(and(
      eq(classDisplayPlaylistItemsTable.classId, classId),
      ne(classDisplayPlaylistItemsTable.serviceDate, serviceDate),
    ));
    const [{ n, maxPos }] = await tx.select({
      n: sql<number>`count(*)::int`,
      maxPos: sql<number>`coalesce(max(${classDisplayPlaylistItemsTable.position}), 0)::int`,
    })
      .from(classDisplayPlaylistItemsTable)
      .where(and(
        eq(classDisplayPlaylistItemsTable.classId, classId),
        eq(classDisplayPlaylistItemsTable.serviceDate, serviceDate),
      ));
    if (n >= MAX_PLAYLIST_ITEMS) return null;
    const [row] = await tx.insert(classDisplayPlaylistItemsTable).values({
      classId,
      serviceDate,
      position: maxPos + 1,
      kind: values.kind,
      label,
      youtubeVideoId: values.youtubeVideoId,
      objectPath: values.objectPath,
      contentType: values.contentType,
      fileName: values.fileName,
      pdfPageCount: values.pdfPageCount,
      bibleId: values.bibleId,
      bibleVersion: values.bibleVersion,
      bibleChapterId: values.bibleChapterId,
      bibleVerseStart: values.bibleVerseStart,
      bibleVerseEnd: values.bibleVerseEnd,
      createdBy: req.user!.userId,
    }).returning();
    return row;
  });
  if (!added) {
    res.status(409).json({ error: "Conflict", message: fullMessage });
    return;
  }
  req.log.info({ classId, itemId: added.id, kind: added.kind }, "Classroom TV list item added");
  res.status(201).json({ item: toClientItem(added, undefined) });
});

router.post("/pickup-requests/display-media/:classId/playlist/:itemId/play", authMiddleware, async (req, res): Promise<void> => {
  const classId = await authorizeClass(req, res);
  if (classId === null) return;
  const itemId = parseItemId(req, res);
  if (itemId === null) return;
  const serviceDate = serviceDateAt();
  const played = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(${TV_MEDIA_LOCK}, ${classId})`);
    const [item] = await tx.select().from(classDisplayPlaylistItemsTable).where(and(
      eq(classDisplayPlaylistItemsTable.id, itemId),
      eq(classDisplayPlaylistItemsTable.classId, classId),
      eq(classDisplayPlaylistItemsTable.serviceDate, serviceDate),
    )).limit(1);
    if (!item) return null;
    // Playing always starts the item from the beginning: PDFs auto-play,
    // Bible passages start at their first verse, unblanked.
    const values = {
      kind: item.kind,
      youtubeVideoId: item.youtubeVideoId,
      objectPath: item.objectPath,
      contentType: item.contentType,
      fileName: item.fileName,
      pdfPage: null,
      pdfPageCount: item.pdfPageCount,
      ...(item.kind === "bible"
        ? {
            bibleId: item.bibleId,
            bibleVersion: item.bibleVersion,
            bibleChapterId: item.bibleChapterId,
            bibleVerseStart: item.bibleVerseStart,
            bibleVerseEnd: item.bibleVerseEnd,
            bibleVerse: item.bibleVerseStart,
            bibleBlanked: false,
          }
        : BIBLE_NO_FIELDS),
    };
    await tx.insert(classDisplayMediaTable)
      .values({ classId, ...values, updatedBy: req.user!.userId })
      .onConflictDoUpdate({
        target: classDisplayMediaTable.classId,
        set: { ...values, updatedBy: req.user!.userId, updatedAt: new Date() },
      });
    await notifyClassRefresh(tx, [classId]);
    return item;
  });
  if (!played) {
    res.status(404).json({ error: "Not found", message: "That item is no longer in today's TV list" });
    return;
  }
  req.log.info({ classId, itemId, kind: played.kind }, "Classroom TV list item played");
  res.json({ success: true });
});

router.put("/pickup-requests/display-media/:classId/playlist/:itemId/move", authMiddleware, async (req, res): Promise<void> => {
  const classId = await authorizeClass(req, res);
  if (classId === null) return;
  const itemId = parseItemId(req, res);
  if (itemId === null) return;
  const direction = (req.body ?? {}).direction;
  if (direction !== "up" && direction !== "down") {
    res.status(400).json({ error: "Bad request", message: "direction must be 'up' or 'down'" });
    return;
  }
  const serviceDate = serviceDateAt();
  const result = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(${PLAYLIST_LOCK}, ${classId})`);
    const items = await tx.select({ id: classDisplayPlaylistItemsTable.id })
      .from(classDisplayPlaylistItemsTable)
      .where(and(
        eq(classDisplayPlaylistItemsTable.classId, classId),
        eq(classDisplayPlaylistItemsTable.serviceDate, serviceDate),
      ))
      .orderBy(asc(classDisplayPlaylistItemsTable.position), asc(classDisplayPlaylistItemsTable.id));
    const index = items.findIndex(i => i.id === itemId);
    if (index === -1) return "missing" as const;
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= items.length) return "unchanged" as const;
    const order = items.map(i => i.id);
    [order[index], order[target]] = [order[target], order[index]];
    // Renumber the whole day's list so positions stay dense and unique.
    for (let i = 0; i < order.length; i++) {
      await tx.update(classDisplayPlaylistItemsTable)
        .set({ position: i + 1 })
        .where(eq(classDisplayPlaylistItemsTable.id, order[i]));
    }
    return "moved" as const;
  });
  if (result === "missing") {
    res.status(404).json({ error: "Not found", message: "That item is no longer in today's TV list" });
    return;
  }
  res.json({ success: true, moved: result === "moved" });
});

router.delete("/pickup-requests/display-media/:classId/playlist/:itemId", authMiddleware, async (req, res): Promise<void> => {
  const classId = await authorizeClass(req, res);
  if (classId === null) return;
  const itemId = parseItemId(req, res);
  if (itemId === null) return;
  // Removing an item from the list never changes what the TV is showing.
  const deleted = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(${PLAYLIST_LOCK}, ${classId})`);
    return tx.delete(classDisplayPlaylistItemsTable)
      .where(and(
        eq(classDisplayPlaylistItemsTable.id, itemId),
        eq(classDisplayPlaylistItemsTable.classId, classId),
      ))
      .returning({ id: classDisplayPlaylistItemsTable.id });
  });
  if (deleted.length === 0) {
    res.status(404).json({ error: "Not found", message: "That item is no longer in today's TV list" });
    return;
  }
  req.log.info({ classId, itemId }, "Classroom TV list item removed");
  res.json({ success: true });
});

export default router;
