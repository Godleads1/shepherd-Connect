import { Router } from "express";
import { createHash, randomBytes } from "crypto";
import { Readable } from "stream";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { db } from "@workspace/db";
import {
  attendanceTable, childrenTable, classesTable, usersTable,
  classMergesTable, classroomDisplayTokensTable, classDisplayMediaTable, pickupRequestsTable,
} from "@workspace/db/schema";
import { ObjectStorageService } from "../lib/objectStorage";
import { bindObjectToResource, registerPendingObject } from "../lib/privateObjectAccess";
import { convertPptxToPdf, looksLikePowerPoint, PptxBusyError, PptxConversionError, MAX_PPTX_BYTES } from "../lib/pptxToPdf";
import { eq, and, gt, isNull, sql, inArray, type SQL } from "drizzle-orm";
import { sendNotification, getClassTeacherUserIds } from "../lib/notify";
import {
  canAccessClass,
  canCreatePickupRequest,
  canDismissPickupRequest,
} from "../lib/childAccess";
import { parentOwnsChild } from "../lib/parentScope";
import { CreateParentPickupRequestBody, CreateParentPickupRequestResponse } from "@workspace/api-zod";
import {
  addClassroomDisplayClient,
  broadcastToClass,
  closeClassroomDisplayClients,
  getPendingCheckInAlertsForClass,
  ensureClassroomDisplayListener,
  notifyClassRefresh,
  removeClassroomDisplayClient,
  type ClassroomDisplayClient,
} from "../services/classroomDisplayAlerts";

const router = Router();

interface PickupRequest {
  id: string;
  childId: number;
  childName: string;
  parentName: string;
  classId: number;
  className: string;
  homeClassName?: string;
  requestedAt: string;
  requestedByUserId: number;
}

export class ParentPickupRequestError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

function pickupRequestFromRow(row: typeof pickupRequestsTable.$inferSelect): PickupRequest {
  return {
    id: String(row.id),
    childId: row.childId,
    childName: row.childName,
    parentName: row.parentName,
    classId: row.classId,
    className: row.className,
    ...(row.homeClassName ? { homeClassName: row.homeClassName } : {}),
    requestedAt: row.requestedAt.toISOString(),
    requestedByUserId: row.requestedBy,
  };
}

async function getActivePickupRequests(where: SQL | undefined): Promise<PickupRequest[]> {
  const rows = await db.select().from(pickupRequestsTable)
    .where(and(eq(pickupRequestsTable.status, "requested"), where))
    .orderBy(pickupRequestsTable.requestedAt);
  return rows.map(pickupRequestFromRow);
}

export async function getPickupRequestsForChildren(childIds: number[]): Promise<PickupRequest[]> {
  if (childIds.length === 0) return [];
  return getActivePickupRequests(and(
    inArray(pickupRequestsTable.childId, childIds),
    eq(pickupRequestsTable.serviceDate, todayWAT()),
  ));
}

async function getPickupRequestsForClass(classId: number): Promise<PickupRequest[]> {
  return getActivePickupRequests(and(
    eq(pickupRequestsTable.classId, classId),
    eq(pickupRequestsTable.serviceDate, todayWAT()),
  ));
}

function todayWAT(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function hashDisplayToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function publicRequest(request: PickupRequest) {
  const { requestedByUserId: _requestedByUserId, ...safe } = request;
  return safe;
}

function publicQueue(queue: PickupRequest[]) {
  return queue.map(publicRequest);
}

/** Shared durable pickup command for HTTP and verified bot callers. */
export async function createParentPickupRequest(parentUserId: number, childId: number) {
  if (!(await parentOwnsChild(parentUserId, childId))) {
    throw new ParentPickupRequestError(403, "You can only request pickup for your own children");
  }
  const [child] = await db.select().from(childrenTable)
    .leftJoin(classesTable, eq(childrenTable.currentClassId, classesTable.id))
    .where(eq(childrenTable.id, childId));
  if (!child) throw new ParentPickupRequestError(404, "Child not found");

  const today = todayWAT();
  const [activeAttendance] = await db.select().from(attendanceTable).where(and(
    eq(attendanceTable.childId, childId), eq(attendanceTable.serviceDate, today),
  )).orderBy(attendanceTable.checkInTime);
  if (!activeAttendance || activeAttendance.status === "picked_up") {
    throw new ParentPickupRequestError(400, "Child is not currently checked in");
  }
  const classId = child.children.currentClassId;
  if (!classId) throw new ParentPickupRequestError(400, "Child has no assigned class");

  const childName = `${child.children.firstName} ${child.children.lastName}`;
  const childClassName = child.classes?.name ?? "Unknown Class";
  const [parent] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
    .from(usersTable).where(eq(usersTable.id, parentUserId));
  const parentName = parent ? `${parent.firstName} ${parent.lastName}` : "A parent";
  const [merge] = await db.select({ targetClassId: classMergesTable.targetClassId }).from(classMergesTable)
    .where(and(eq(classMergesTable.sourceClassId, classId), eq(classMergesTable.serviceDate, today))).limit(1);
  const routingClassId = merge?.targetClassId ?? classId;
  let routingClassName = childClassName;
  if (merge) {
    const [hostClass] = await db.select({ name: classesTable.name }).from(classesTable)
      .where(eq(classesTable.id, merge.targetClassId));
    if (hostClass) routingClassName = hostClass.name;
  }
  const inserted = await db.transaction(async tx => {
    const rows = await tx.insert(pickupRequestsTable).values({
      childId, classId: routingClassId, serviceDate: today, requestedBy: parentUserId,
      childName, parentName, className: routingClassName, homeClassName: merge ? childClassName : null,
    }).onConflictDoNothing().returning();
    if (rows.length) await notifyClassRefresh(tx, [routingClassId]);
    return rows;
  });
  const duplicate = inserted.length === 0;
  const row = inserted[0] ?? (await db.select().from(pickupRequestsTable).where(and(
    eq(pickupRequestsTable.childId, childId), eq(pickupRequestsTable.serviceDate, today),
    eq(pickupRequestsTable.status, "requested"),
  )).limit(1))[0];
  if (!row) throw new ParentPickupRequestError(409, "Could not create or recover the pickup signal");
  const request = pickupRequestFromRow(row);
  if (!duplicate) {
    const teacherUserIds = await getClassTeacherUserIds(routingClassId, today);
    const pickupMsg = merge
      ? `${parentName} is here to collect ${childName} (from ${childClassName}, merged with ${routingClassName}). Please prepare for handover.`
      : `${parentName} is here to collect ${childName} from ${childClassName}. Please prepare for handover.`;
    await Promise.all(teacherUserIds.map(userId => sendNotification({
      userId, type: "pickup_request", title: "Pickup Request", message: pickupMsg,
    })));
  }
  return { duplicate, request: publicRequest(request), childName };
}

async function resolveClass(classNumber: number) {
  // Resolve by DB ID first: the UI always opens /classroom-display/{dbId} and
  // display credentials are issued per DB ID, so name-first resolution could
  // pick a different class whenever "Class N"'s DB id isn't N — making the
  // credential permanently invalid for that TV. Fall back to name lookup for
  // manually typed URLs when no class has that DB id.
  let [cls] = await db
    .select({ id: classesTable.id, name: classesTable.name })
    .from(classesTable)
    .where(eq(classesTable.id, classNumber));
  if (!cls) {
    [cls] = await db
      .select({ id: classesTable.id, name: classesTable.name })
      .from(classesTable)
      .where(eq(classesTable.name, `Class ${classNumber}`));
  }
  return cls ?? null;
}

async function validateDisplayToken(token: string, classId: number): Promise<boolean> {
  if (!token || token.length > 256) return false;
  const [credential] = await db
    .select({ id: classroomDisplayTokensTable.id })
    .from(classroomDisplayTokensTable)
    .where(and(
      eq(classroomDisplayTokensTable.tokenHash, hashDisplayToken(token)),
      eq(classroomDisplayTokensTable.classId, classId),
      isNull(classroomDisplayTokensTable.revokedAt),
      gt(classroomDisplayTokensTable.expiresAt, new Date()),
    ))
    .limit(1);
  return Boolean(credential);
}

// ── Classroom display media (set remotely from a teacher's phone) ────────────
const objectStorage = new ObjectStorageService();
const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

/**
 * Stable version tag for an uploaded display file. Changes when the file is
 * replaced (uploads always get fresh object paths) but NOT on page turns, so
 * the TV only re-downloads the PDF when it's actually a different document.
 */
function displayMediaVersion(objectPath: string): string {
  return createHash("sha1").update(objectPath).digest("hex").slice(0, 12);
}

type ClientDisplayMedia =
  | { kind: "youtube"; videoId: string }
  | {
      kind: "file";
      url: string;
      contentType: string;
      name: string;
      /** PDFs only: page pinned by the phone "clicker"; null = auto-play. */
      page: number | null;
      pageCount: number | null;
      /** PDFs only: identifies the file so stale page events can be ignored. */
      v?: string;
    }
  | null;

/**
 * Resolves the media a class TV should show right now. Uploaded files are
 * converted to short-lived signed download URLs so the TV (which only holds a
 * display token, not a user session) can stream them directly with full
 * seeking support.
 */
async function getClientDisplayMedia(classId: number): Promise<ClientDisplayMedia> {
  const [row] = await db
    .select()
    .from(classDisplayMediaTable)
    .where(eq(classDisplayMediaTable.classId, classId))
    .limit(1);
  if (!row) return null;
  if (row.kind === "youtube" && row.youtubeVideoId) {
    return { kind: "youtube", videoId: row.youtubeVideoId };
  }
  if (row.kind === "file" && row.objectPath) {
    const contentType = row.contentType ?? "application/octet-stream";
    // PDFs are rendered on the TV with pdf.js, which fetches the bytes with
    // XHR — so they must come from our own origin (signed GCS URLs would need
    // CORS). The TV appends its display token to this path itself.
    if (contentType === "application/pdf") {
      const v = displayMediaVersion(row.objectPath);
      return {
        kind: "file",
        // The version stamp makes the TV reload when a different PDF replaces
        // this one (the path alone is identical for every upload).
        url: `/api/pickup-requests/display-file/${classId}?v=${v}`,
        contentType,
        name: row.fileName ?? "slides.pdf",
        page: row.pdfPage,
        pageCount: row.pdfPageCount,
        v,
      };
    }
    try {
      const url = await objectStorage.getObjectEntityDownloadURL(row.objectPath, 12 * 60 * 60);
      return {
        kind: "file",
        url,
        contentType,
        name: row.fileName ?? "media",
        page: null,
        pageCount: null,
      };
    } catch {
      // Signing can fail transiently; the TV simply keeps its idle screen.
      return null;
    }
  }
  return null;
}

async function broadcastDisplayMedia(classId: number) {
  await broadcastToClass(classId, {
    type: "media",
    media: await getClientDisplayMedia(classId),
  });
}

router.get("/pickup-requests/stream/:classNumber", async (req, res): Promise<void> => {
  const classNumber = Number(req.params.classNumber);
  if (isNaN(classNumber)) { res.status(400).end(); return; }
  const displayToken = typeof req.query["displayToken"] === "string" ? req.query["displayToken"] : "";
  if (!displayToken) {
    res.status(401).json({ error: "Unauthorized", message: "A display credential is required" });
    return;
  }

  // Prefer looking up by class name ("Class N") so that /classroom-display/12
  // always resolves to the class named "Class 12" regardless of its DB ID.
  // Fall back to DB ID lookup for links generated by the UI.
  const cls = await resolveClass(classNumber);
  if (!cls) {
    res.status(404).json({ error: "Not found", message: "Class not found" });
    return;
  }

  const client: ClassroomDisplayClient = { res, displayToken };
  try {
    await ensureClassroomDisplayListener();
  } catch {
    res.status(503).json({ error: "Unavailable", message: "Classroom display updates are temporarily unavailable" });
    return;
  }
  const initialMedia = await getClientDisplayMedia(cls.id);
  let registered = false;
  try {
    registered = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(68431, ${cls.id})`);
      const [credential] = await tx
        .select({ id: classroomDisplayTokensTable.id })
        .from(classroomDisplayTokensTable)
        .where(and(
          eq(classroomDisplayTokensTable.tokenHash, hashDisplayToken(displayToken)),
          eq(classroomDisplayTokensTable.classId, cls.id),
          isNull(classroomDisplayTokensTable.revokedAt),
          gt(classroomDisplayTokensTable.expiresAt, new Date()),
        ))
        .limit(1);
      if (!credential) return false;
      addClassroomDisplayClient(cls.id, client);
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();
      const queue = await getPickupRequestsForClass(cls.id);
      const checkInAlerts = await getPendingCheckInAlertsForClass(cls.id);
      res.write(`data: ${JSON.stringify({ type: "init", queue: publicQueue(queue), checkInAlerts, className: cls.name, media: initialMedia })}\n\n`);
      return true;
    });
  } catch {
    removeClassroomDisplayClient(cls.id, client);
    if (!res.headersSent) {
      res.status(503).json({ error: "Unavailable", message: "Could not verify display access" });
    } else {
      res.end();
    }
    return;
  }
  if (!registered) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid, expired, or revoked display credential" });
    return;
  }

  let closed = false;
  const ping = setInterval(async () => {
    try {
      if (!(await validateDisplayToken(displayToken, cls.id))) {
        closed = true;
        clearInterval(ping);
        removeClassroomDisplayClient(cls.id, client);
        res.write(`event: revoked\ndata: ${JSON.stringify({ reason: "Display credential expired or revoked" })}\n\n`);
        res.end();
        return;
      }
      res.write(": ping\n\n");
    } catch {
      closed = true;
      clearInterval(ping);
      removeClassroomDisplayClient(cls.id, client);
      res.end();
    }
  }, 25000);

  req.on("close", () => {
    if (closed) return;
    closed = true;
    clearInterval(ping);
    removeClassroomDisplayClient(cls.id, client);
  });
});

router.post("/pickup-requests/display-credentials", authMiddleware, async (req, res): Promise<void> => {
  const classId = Number((req.body as { classId?: number })?.classId);
  if (!Number.isInteger(classId) || classId <= 0) {
    res.status(400).json({ error: "Bad request", message: "A valid classId is required" });
    return;
  }
  const [cls] = await db.select({ id: classesTable.id, name: classesTable.name })
    .from(classesTable).where(eq(classesTable.id, classId)).limit(1);
  if (!cls) {
    res.status(404).json({ error: "Not found", message: "Class not found" });
    return;
  }
  if (!(await canAccessClass(req.user!, classId, todayWAT()))) {
    res.status(403).json({ error: "Forbidden", message: "You are not assigned to this class" });
    return;
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(68431, ${classId})`);
    await tx.update(classroomDisplayTokensTable)
      .set({ revokedAt: new Date() })
      .where(and(
        eq(classroomDisplayTokensTable.classId, classId),
        isNull(classroomDisplayTokensTable.revokedAt),
      ));
    await tx.insert(classroomDisplayTokensTable).values({
      classId,
      tokenHash: hashDisplayToken(token),
      issuedBy: req.user!.userId,
      expiresAt,
    });
  });
  closeClassroomDisplayClients(classId, "A new classroom display link was issued");

  res.status(201).json({ token, classId, className: cls.name, expiresAt });
});

router.delete("/pickup-requests/display-credentials/:classId", authMiddleware, async (req, res): Promise<void> => {
  const classId = Number(req.params.classId);
  if (!Number.isInteger(classId) || classId <= 0) {
    res.status(400).json({ error: "Bad request", message: "Invalid class ID" });
    return;
  }
  if (!(await canAccessClass(req.user!, classId, todayWAT()))) {
    res.status(403).json({ error: "Forbidden", message: "You are not assigned to this class" });
    return;
  }
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(68431, ${classId})`);
    await tx.update(classroomDisplayTokensTable)
      .set({ revokedAt: new Date() })
      .where(and(
        eq(classroomDisplayTokensTable.classId, classId),
        isNull(classroomDisplayTokensTable.revokedAt),
      ));
  });
  closeClassroomDisplayClients(classId, "Classroom display access was revoked");
  res.json({ success: true });
});

// ── Display media endpoints — staff set the TV's video/image from their own
// device; the TV updates instantly over its existing SSE connection. ─────────

router.get("/pickup-requests/display-media/:classId", authMiddleware, async (req, res): Promise<void> => {
  const classId = Number(req.params.classId);
  if (!Number.isInteger(classId) || classId <= 0) {
    res.status(400).json({ error: "Bad request", message: "Invalid class ID" });
    return;
  }
  if (!(await canAccessClass(req.user!, classId, todayWAT()))) {
    res.status(403).json({ error: "Forbidden", message: "You are not assigned to this class" });
    return;
  }
  const [row] = await db
    .select()
    .from(classDisplayMediaTable)
    .where(eq(classDisplayMediaTable.classId, classId))
    .limit(1);
  res.json({
    media: row
      ? {
          kind: row.kind,
          youtubeVideoId: row.youtubeVideoId,
          fileName: row.fileName,
          contentType: row.contentType,
          pdfPage: row.pdfPage,
          pdfPageCount: row.pdfPageCount,
          updatedAt: row.updatedAt,
        }
      : null,
  });
});

router.put("/pickup-requests/display-media/:classId", authMiddleware, async (req, res): Promise<void> => {
  const classId = Number(req.params.classId);
  if (!Number.isInteger(classId) || classId <= 0) {
    res.status(400).json({ error: "Bad request", message: "Invalid class ID" });
    return;
  }
  const [cls] = await db.select({ id: classesTable.id })
    .from(classesTable).where(eq(classesTable.id, classId)).limit(1);
  if (!cls) {
    res.status(404).json({ error: "Not found", message: "Class not found" });
    return;
  }
  if (!(await canAccessClass(req.user!, classId, todayWAT()))) {
    res.status(403).json({ error: "Forbidden", message: "You are not assigned to this class" });
    return;
  }

  const body = (req.body ?? {}) as {
    kind?: string;
    youtubeVideoId?: string;
    objectPath?: string;
    contentType?: string;
    fileName?: string;
    pdfPageCount?: number;
  };

  let values: {
    kind: string;
    youtubeVideoId: string | null;
    objectPath: string | null;
    contentType: string | null;
    fileName: string | null;
    pdfPage: number | null;
    pdfPageCount: number | null;
  };

  // Set when a PowerPoint is converted during this request. Conversion takes
  // seconds, so the final write must not clobber media someone else set while
  // we were converting — it's guarded against this snapshot of the row.
  let conversionGuard: { prev: { kind: string; objectPath: string | null } | null } | null = null;

  if (body.kind === "youtube") {
    if (typeof body.youtubeVideoId !== "string" || !YOUTUBE_ID_RE.test(body.youtubeVideoId)) {
      res.status(400).json({ error: "Bad request", message: "A valid YouTube video ID is required" });
      return;
    }
    values = {
      kind: "youtube",
      youtubeVideoId: body.youtubeVideoId,
      objectPath: null,
      contentType: null,
      fileName: null,
      pdfPage: null,
      pdfPageCount: null,
    };
  } else if (body.kind === "file") {
    let objectPath = body.objectPath;
    let contentType = body.contentType ?? "";
    const fileName = typeof body.fileName === "string" ? body.fileName.slice(0, 200) : "media";
    if (typeof objectPath !== "string" || !objectPath.startsWith("/objects/")) {
      res.status(400).json({ error: "Bad request", message: "A valid uploaded file is required" });
      return;
    }
    let isPdf = contentType === "application/pdf";
    const isPpt = !isPdf && looksLikePowerPoint(contentType, fileName);
    if (!contentType.startsWith("video/") && !contentType.startsWith("image/") && !isPdf && !isPpt) {
      res.status(400).json({ error: "Bad request", message: "Only video, image, PDF, or PowerPoint files can be shown on the TV" });
      return;
    }
    const bound = await bindObjectToResource(objectPath, "class_display", classId, req.user!);
    if (!bound) {
      res.status(400).json({ error: "Bad request", message: "The uploaded file could not be verified. Please upload it again." });
      return;
    }
    let pageCount =
      isPdf && Number.isInteger(body.pdfPageCount) && body.pdfPageCount! >= 1 && body.pdfPageCount! <= 5000
        ? body.pdfPageCount!
        : null;

    if (isPpt) {
      // PowerPoint can't be rendered by the TV directly — convert it to PDF
      // here, store the PDF, and from this point on it behaves exactly like an
      // uploaded PDF (slideshow + phone clicker).
      try {
        // Snapshot what's on the TV before the (slow) conversion starts.
        const [prevRow] = await db
          .select({ kind: classDisplayMediaTable.kind, objectPath: classDisplayMediaTable.objectPath })
          .from(classDisplayMediaTable)
          .where(eq(classDisplayMediaTable.classId, classId))
          .limit(1);
        const file = await objectStorage.getObjectEntityFile(objectPath);
        const [meta] = await file.getMetadata();
        if (Number(meta.size ?? 0) > MAX_PPTX_BYTES) {
          res.status(400).json({ error: "Bad request", message: "That PowerPoint is too large (max 50 MB). Export it as PDF and upload that instead." });
          return;
        }
        const [pptxBytes] = await file.download();
        const { pdf, pageCount: convertedPages } = await convertPptxToPdf(pptxBytes);
        const pdfPath = await objectStorage.uploadObjectEntityFromBuffer(pdf, "application/pdf");
        // Register + bind the server-generated PDF the same way a normal
        // upload would be, so staff access checks keep working for it.
        await registerPendingObject(pdfPath, req.user!.userId);
        if (!(await bindObjectToResource(pdfPath, "class_display", classId, req.user!))) {
          throw new Error("Could not bind the converted PDF to the class display");
        }
        objectPath = pdfPath;
        contentType = "application/pdf";
        isPdf = true;
        pageCount = convertedPages;
        conversionGuard = { prev: prevRow ?? null };
      } catch (error) {
        if (error instanceof PptxBusyError) {
          res.status(503).json({
            error: "Busy",
            message: "Other slides are being prepared right now — please try again in a minute.",
          });
          return;
        }
        req.log.error({ err: error, classId }, "PowerPoint → PDF conversion failed");
        res.status(error instanceof PptxConversionError ? 400 : 500).json({
          error: "Conversion failed",
          message: "We couldn't convert this PowerPoint. Try exporting it as PDF (File → Save As → PDF) and uploading that instead.",
        });
        return;
      }
    }

    values = {
      kind: "file",
      youtubeVideoId: null,
      objectPath,
      contentType,
      fileName,
      pdfPage: null, // new PDFs start in auto-play; the phone clicker can pin a page
      pdfPageCount: pageCount,
    };
  } else {
    res.status(400).json({ error: "Bad request", message: "kind must be 'youtube' or 'file'" });
    return;
  }

  if (conversionGuard) {
    // Guarded write: only land the converted PDF if the TV's media is still
    // exactly what it was when the conversion started. Uploads always get
    // fresh object paths, so (kind, objectPath) identifies the row's content.
    let wrote = false;
    if (conversionGuard.prev) {
      const updated = await db
        .update(classDisplayMediaTable)
        .set({ ...values, updatedBy: req.user!.userId, updatedAt: new Date() })
        .where(and(
          eq(classDisplayMediaTable.classId, classId),
          eq(classDisplayMediaTable.kind, conversionGuard.prev.kind),
          conversionGuard.prev.objectPath
            ? eq(classDisplayMediaTable.objectPath, conversionGuard.prev.objectPath)
            : isNull(classDisplayMediaTable.objectPath),
        ))
        .returning({ id: classDisplayMediaTable.id });
      wrote = updated.length > 0;
    } else {
      const inserted = await db
        .insert(classDisplayMediaTable)
        .values({ classId, ...values, updatedBy: req.user!.userId })
        .onConflictDoNothing({ target: classDisplayMediaTable.classId })
        .returning({ id: classDisplayMediaTable.id });
      wrote = inserted.length > 0;
    }
    if (!wrote) {
      res.status(409).json({
        error: "Conflict",
        message: "While your slides were being prepared, someone else changed the TV. Check what's on the TV and try again.",
      });
      return;
    }
  } else {
    await db
      .insert(classDisplayMediaTable)
      .values({ classId, ...values, updatedBy: req.user!.userId })
      .onConflictDoUpdate({
        target: classDisplayMediaTable.classId,
        set: { ...values, updatedBy: req.user!.userId, updatedAt: new Date() },
      });
  }

  await broadcastDisplayMedia(classId);
  req.log.info({ classId, kind: values.kind }, "Classroom display media updated");
  res.json({ success: true });
});

router.delete("/pickup-requests/display-media/:classId", authMiddleware, async (req, res): Promise<void> => {
  const classId = Number(req.params.classId);
  if (!Number.isInteger(classId) || classId <= 0) {
    res.status(400).json({ error: "Bad request", message: "Invalid class ID" });
    return;
  }
  if (!(await canAccessClass(req.user!, classId, todayWAT()))) {
    res.status(403).json({ error: "Forbidden", message: "You are not assigned to this class" });
    return;
  }
  await db.delete(classDisplayMediaTable).where(eq(classDisplayMediaTable.classId, classId));
  await broadcastDisplayMedia(classId);
  req.log.info({ classId }, "Classroom display media cleared");
  res.json({ success: true });
});

// Phone "clicker" for PDF slides: pin a page on the TV, or return to auto-play
// (page = null). Broadcast as a lightweight event so the TV doesn't re-fetch
// the PDF on every page turn.
router.put("/pickup-requests/display-media/:classId/page", authMiddleware, async (req, res): Promise<void> => {
  const classId = Number(req.params.classId);
  if (!Number.isInteger(classId) || classId <= 0) {
    res.status(400).json({ error: "Bad request", message: "Invalid class ID" });
    return;
  }
  if (!(await canAccessClass(req.user!, classId, todayWAT()))) {
    res.status(403).json({ error: "Forbidden", message: "You are not assigned to this class" });
    return;
  }
  const [row] = await db
    .select()
    .from(classDisplayMediaTable)
    .where(eq(classDisplayMediaTable.classId, classId))
    .limit(1);
  if (!row || row.kind !== "file" || row.contentType !== "application/pdf") {
    res.status(409).json({ error: "Conflict", message: "The TV is not currently showing PDF slides" });
    return;
  }
  const rawPage = (req.body ?? {}).page;
  let page: number | null;
  if (rawPage === null || rawPage === undefined) {
    page = null; // resume auto-play
  } else if (Number.isInteger(rawPage) && rawPage >= 1) {
    page = row.pdfPageCount ? Math.min(rawPage, row.pdfPageCount) : Math.min(rawPage, 5000);
  } else {
    res.status(400).json({ error: "Bad request", message: "page must be a positive number or null" });
    return;
  }
  // Conditional update: if the PDF was replaced between our read and this
  // write (uploads always get fresh object paths), don't pin a page on the
  // replacement — tell the phone to refresh instead.
  const updated = await db
    .update(classDisplayMediaTable)
    .set({ pdfPage: page, updatedBy: req.user!.userId, updatedAt: new Date() })
    .where(and(
      eq(classDisplayMediaTable.classId, classId),
      eq(classDisplayMediaTable.objectPath, row.objectPath!),
      eq(classDisplayMediaTable.contentType, "application/pdf"),
    ))
    .returning({ id: classDisplayMediaTable.id });
  if (updated.length === 0) {
    res.status(409).json({ error: "Conflict", message: "The TV's slides just changed — check the current slides and try again" });
    return;
  }
  await broadcastToClass(classId, { type: "media-page", page, v: displayMediaVersion(row.objectPath!) });
  res.json({ success: true, page });
});

// Streams the class's uploaded display file to the TV. Authenticated by the
// display token (the TV never holds a user session); used for PDFs, which
// pdf.js must fetch from our own origin.
router.get("/pickup-requests/display-file/:classId", async (req, res): Promise<void> => {
  const classId = Number(req.params.classId);
  const displayToken = typeof req.query["displayToken"] === "string" ? req.query["displayToken"] : "";
  if (!Number.isInteger(classId) || classId <= 0 || !displayToken) {
    res.status(401).json({ error: "Unauthorized", message: "A display credential is required" });
    return;
  }
  if (!(await validateDisplayToken(displayToken, classId))) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid, expired, or revoked display credential" });
    return;
  }
  const [row] = await db
    .select()
    .from(classDisplayMediaTable)
    .where(eq(classDisplayMediaTable.classId, classId))
    .limit(1);
  if (!row || row.kind !== "file" || !row.objectPath) {
    res.status(404).json({ error: "Not found", message: "No file is set for this classroom display" });
    return;
  }
  try {
    const file = await objectStorage.getObjectEntityFile(row.objectPath);
    const response = await objectStorage.downloadObject(file, 300);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.setHeader("Cache-Control", "private, max-age=300");
    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error, classId }, "Error streaming classroom display file");
    if (!res.headersSent) {
      res.status(404).json({ error: "Not found", message: "The display file could not be loaded" });
    }
  }
});

router.get("/pickup-requests", authMiddleware, requireRoles("super_admin", "admin", "support"), async (req, res): Promise<void> => {
  const all = await getActivePickupRequests(eq(pickupRequestsTable.serviceDate, todayWAT()));
  all.sort((a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime());
  res.json({ queue: all });
});

router.post("/pickup-requests", authMiddleware, async (req, res): Promise<void> => {
  const parsed = CreateParentPickupRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad request", message: parsed.error.message });
    return;
  }
  const { childId } = parsed.data;
  if (req.user!.role !== "parent" || !canCreatePickupRequest(req.user!.role, true)) {
    res.status(403).json({ error: "Forbidden", message: "You can only request pickup for your own children" });
    return;
  }
  try {
    const outcome = await createParentPickupRequest(req.user!.userId, childId);
    if (!outcome.duplicate) req.log.info({ childId, parentUserId: req.user!.userId }, "Parent signalled pickup");
    res.json(CreateParentPickupRequestResponse.parse({
      success: true, duplicate: outcome.duplicate, status: "requested", request: outcome.request,
      message: outcome.duplicate ? "Pickup signal is already active" : "Pickup signal sent to classroom",
    }));
  } catch (error) {
    if (error instanceof ParentPickupRequestError) {
      res.status(error.statusCode).json({ error: "Pickup request rejected", message: error.message });
      return;
    }
    throw error;
  }
});

router.delete("/pickup-requests/:id", authMiddleware, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [request] = await db.select().from(pickupRequestsTable).where(and(
    eq(pickupRequestsTable.id, id),
    eq(pickupRequestsTable.status, "requested"),
  )).limit(1);
  if (!request) { res.status(404).json({ error: "Not found" }); return; }
  const ownsChild = req.user!.role === "parent"
    ? await parentOwnsChild(req.user!.userId, request.childId)
    : false;
  const hasClassAccess = req.user!.role === "teacher"
    ? await canAccessClass(req.user!, request.classId, todayWAT())
    : false;
  if (!canDismissPickupRequest(req.user!.role, ownsChild, hasClassAccess)) {
    res.status(403).json({ error: "Forbidden", message: "You cannot dismiss this pickup request" });
    return;
  }
  const now = new Date();
  const status = req.user!.role === "parent" ? "cancelled" : "resolved";
  const updated = await db.transaction(async tx => {
    const rows = await tx.update(pickupRequestsTable).set(status === "cancelled"
      ? { status, cancelledAt: now, cancelledBy: req.user!.userId, updatedAt: now }
      : { status, resolvedAt: now, resolvedBy: req.user!.userId, updatedAt: now })
      .where(and(eq(pickupRequestsTable.id, id), eq(pickupRequestsTable.status, "requested")))
      .returning({ id: pickupRequestsTable.id });
    if (rows.length) await notifyClassRefresh(tx, [request.classId]);
    return rows;
  });
  if (updated.length === 0) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ success: true });
});

router.get("/pickup-requests/:classId", authMiddleware, async (req, res): Promise<void> => {
  const classId = Number(req.params.classId);
  if (isNaN(classId)) { res.status(400).json({ error: "Bad request" }); return; }
  if (!(await canAccessClass(req.user!, classId, todayWAT()))) {
    res.status(403).json({ error: "Forbidden", message: "You are not assigned to this class" });
    return;
  }
  res.json({ queue: publicQueue(await getPickupRequestsForClass(classId)) });
});

export default router;
