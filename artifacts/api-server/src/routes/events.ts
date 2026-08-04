import { Router } from "express";
import { verifyToken } from "../middlewares/auth";
import { addConnection, removeConnection } from "../lib/sse";

const router = Router();

/**
 * GET /events
 *
 * Server-Sent Events endpoint. EventSource (browser API) cannot send custom
 * headers, so the JWT is accepted as a ?token= query param for this route only.
 *
 * Events pushed from the server:
 *   connected       — initial handshake
 *   new_message     — a message was sent to this user
 *   new_notification — a notification was created for this user
 */
router.get("/events", (req, res): void => {
  const token = req.query["token"] as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Unauthorized", message: "No token provided" });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token" });
    return;
  }

  const userId = payload.userId;

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  // Disable Nginx/proxy response buffering so events are flushed immediately
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Initial handshake event
  res.write(`event: connected\ndata: {"userId":${userId}}\n\n`);

  addConnection(userId, res);

  // Heartbeat comment every 25 s — keeps the connection alive through load
  // balancers and CDN proxies that close idle connections at ~30 s.
  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
    }
  }, 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    removeConnection(userId, res);
  });
});

export default router;
