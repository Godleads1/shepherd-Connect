import { Router } from "express";
import { and, eq, gt, isNull } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { db, sseTicketsTable, usersTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/auth";
import { addConnection, removeConnection } from "../lib/sse";
import { startSessionInvalidationListener } from "../lib/sessionInvalidation";
import { lockSessionRevocation } from "../lib/sessionRevocation";

const router = Router();
startSessionInvalidationListener();
export const TICKET_COOKIE = "sse_ticket";
export const TICKET_TTL_SECONDS = 30;
export const STREAM_MAX_AGE_MS = 5 * 60_000;

function ticketHash(ticket: string): string {
  return createHash("sha256").update(ticket).digest("hex");
}

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  const prefix = `${name}=`;
  const value = header.split(";").map(part => part.trim()).find(part => part.startsWith(prefix));
  return value ? value.slice(prefix.length) : undefined;
}

function clearTicketCookie(res: import("express").Response): void {
  res.clearCookie(TICKET_COOKIE, { httpOnly: true, sameSite: "strict", path: "/api/events" });
}

/**
 * POST /events/ticket
 *
 * EventSource cannot attach an Authorization header. A normal authenticated
 * REST request mints a short-lived, one-time cookie for the SSE endpoint only.
 */
router.post("/events/ticket", authMiddleware, async (req, res): Promise<void> => {
  const ticket = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TICKET_TTL_SECONDS * 1000);

  await db.insert(sseTicketsTable).values({
    ticketHash: ticketHash(ticket),
    userId: req.user!.userId,
    selectedRole: req.user!.role,
    sessionVersion: req.user!.sessionVersion ?? 1,
    purpose: "sse",
    expiresAt,
  });

  // Secure is set only when this request is actually HTTPS in production.
  res.cookie(TICKET_COOKIE, ticket, {
    httpOnly: true,
    sameSite: "strict",
    path: "/api/events",
    maxAge: TICKET_TTL_SECONDS * 1000,
    secure: process.env.NODE_ENV === "production" && req.secure,
  });
  res.status(201).json({ expiresAt: expiresAt.toISOString() });
});

/**
 * GET /events
 *
 * Events pushed from the server:
 *   connected       — initial handshake
 *   new_message     — a message was sent to this user
 *   new_notification — a notification was created for this user
 */
router.get("/events", async (req, res): Promise<void> => {
  const ticket = readCookie(req.headers.cookie, TICKET_COOKIE);
  if (!ticket) {
    clearTicketCookie(res);
    res.status(401).json({ error: "Unauthorized", message: "SSE ticket required" });
    return;
  }

  // This conditional update is the one-time redemption boundary. Concurrent
  // requests cannot both receive a row from RETURNING.
  const [redeemed] = await db.update(sseTicketsTable)
    .set({ consumedAt: new Date() })
    .where(and(
      eq(sseTicketsTable.ticketHash, ticketHash(ticket)),
      eq(sseTicketsTable.purpose, "sse"),
      gt(sseTicketsTable.expiresAt, new Date()),
      isNull(sseTicketsTable.consumedAt),
    ))
    .returning();
  clearTicketCookie(res);

  if (!redeemed) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid or expired SSE ticket" });
    return;
  }

  const userId = redeemed.userId;
  const streamSessionVersion = redeemed.sessionVersion ?? 1;
  let registered = false;
  let authorized = false;
  try {
    authorized = await db.transaction(async tx => {
      // Shared with every revoker. Headers, initial synchronous write, and
      // registry insertion form one ordered handshake; no lock is retained
      // across heartbeat/drain/network awaits.
      await lockSessionRevocation(tx, userId, true);
      const [user] = await tx.select({
        id: usersTable.id, role: usersTable.role, secondaryRoles: usersTable.secondaryRoles,
        isActive: usersTable.isActive, status: usersTable.status,
        sessionVersion: usersTable.sessionVersion,
      }).from(usersTable).where(eq(usersTable.id, userId));
      let secondaryRoles: string[] = [];
      try {
        const parsed = JSON.parse(user?.secondaryRoles ?? "[]");
        if (Array.isArray(parsed)) secondaryRoles = parsed.filter((role): role is string => typeof role === "string");
      } catch { secondaryRoles = []; }
      if (!user || !user.isActive || user.status !== "active" ||
        !new Set<string>([user.role, ...secondaryRoles]).has(redeemed.selectedRole) ||
        (user.sessionVersion ?? 1) !== streamSessionVersion) return false;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();
      res.write(`event: connected\ndata: {"userId":${userId}}\n\n`);
      addConnection(userId, res, streamSessionVersion, redeemed.selectedRole);
      registered = true;
      return true;
    });
  } catch {
    if (registered) removeConnection(userId, res);
    try { res.end(); } catch { /* already closed */ }
    return;
  }
  if (!authorized) {
    res.status(401).json({ error: "Unauthorized", message: "Account is not active" });
    return;
  }

  // Heartbeat comment every 25 s — keeps the connection alive through load
  // balancers and CDN proxies that close idle connections at ~30 s.
  const heartbeat = setInterval(async () => {
    try {
      const [current] = await db.select({
        isActive: usersTable.isActive,
        status: usersTable.status,
        role: usersTable.role,
        secondaryRoles: usersTable.secondaryRoles,
        sessionVersion: usersTable.sessionVersion,
      }).from(usersTable).where(eq(usersTable.id, userId));
      let roles: string[] = [];
      try {
        const parsed = JSON.parse(current?.secondaryRoles ?? "[]");
        if (Array.isArray(parsed)) roles = parsed.filter((role): role is string => typeof role === "string");
      } catch { roles = []; }
      if (!current || !current.isActive || current.status !== "active" ||
        current.sessionVersion !== streamSessionVersion ||
        !new Set([current.role, ...roles]).has(redeemed.selectedRole)) {
        close();
        res.end();
        return;
      }
      res.write(": heartbeat\n\n");
    } catch {
      close();
      res.end();
    }
  }, 25_000);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    clearTimeout(maxAge);
    removeConnection(userId, res);
  };
  const maxAge = setTimeout(() => {
    close();
    res.end();
  }, STREAM_MAX_AGE_MS);
  req.on("close", close);
});

export default router;
