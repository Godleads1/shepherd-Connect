import { Router } from "express";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";
import { vapidPublicKey } from "../services/push";
import { z } from "zod";

const router = Router();

const SubscribeBody = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

// Return the VAPID public key so the browser can subscribe
router.get("/push/vapid-public-key", (_req, res) => {
  res.json({ publicKey: vapidPublicKey });
});

// Save a new push subscription for the logged-in user
router.post("/push/subscribe", authMiddleware, async (req, res): Promise<void> => {
  const parsed = SubscribeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad request", message: parsed.error.message });
    return;
  }
  const { endpoint, keys } = parsed.data;
  const userId = req.user!.userId;
  const userAgent = (req.headers["user-agent"] ?? "").slice(0, 255);

  // Upsert: if this endpoint already exists for this user just update; if endpoint
  // belongs to a different user (device reuse) replace with current user.
  const existing = await db.select().from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.endpoint, endpoint));

  if (existing.length > 0) {
    await db.update(pushSubscriptionsTable)
      .set({ userId, p256dh: keys.p256dh, auth: keys.auth, userAgent })
      .where(eq(pushSubscriptionsTable.endpoint, endpoint));
  } else {
    await db.insert(pushSubscriptionsTable).values({
      userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent,
    });
  }

  res.json({ success: true });
});

// Remove a push subscription (user explicitly disabling push)
router.delete("/push/unsubscribe", authMiddleware, async (req, res): Promise<void> => {
  const { endpoint } = req.body as { endpoint?: string };
  if (!endpoint) {
    res.status(400).json({ error: "Bad request", message: "endpoint required" });
    return;
  }
  await db.delete(pushSubscriptionsTable)
    .where(and(
      eq(pushSubscriptionsTable.endpoint, endpoint),
      eq(pushSubscriptionsTable.userId, req.user!.userId),
    ));
  res.json({ success: true });
});

// Check if the current user has any active push subscriptions
router.get("/push/status", authMiddleware, async (req, res): Promise<void> => {
  const subs = await db.select({ id: pushSubscriptionsTable.id })
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.userId, req.user!.userId));
  res.json({ subscribed: subs.length > 0, count: subs.length });
});

export default router;
