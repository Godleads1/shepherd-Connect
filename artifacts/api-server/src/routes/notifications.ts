import { Router } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, notificationsTable, usersTable, churchSettingsTable, whatsappBroadcastsTable, notificationOutboxTable } from "@workspace/db";
import {
  ListNotificationsQueryParams,
  GetNotificationPreferencesResponse,
  UpdateNotificationPreferencesBody,
  UpdateNotificationPreferencesResponse,
} from "@workspace/api-zod";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { pushToUsers, pushToRole } from "../services/push";
import { pushEventToUsers } from "../lib/sse";
import { createNotificationDelivery } from "../services/notificationOutbox";
import { runRateLimitedAudienceOperation } from "../lib/rateLimitedAudienceOperation";

const LOCATION_DEFAULTS = {
  churchName: "RCCG City of David",
  address: "Victoria Island, Lagos",
  mapsUrl: "https://maps.app.goo.gl/uvgtpVETsCeqkzmDA",
};

async function getPickupLocation(): Promise<{ pickupAddress: string; mapsLink: string }> {
  try {
    const rows = await db.select().from(churchSettingsTable).where(eq(churchSettingsTable.id, 1));
    const row = rows[0];
    if (row) {
      return {
        pickupAddress: `${row.churchName}, ${row.address}`,
        mapsLink: row.mapsUrl,
      };
    }
  } catch {
    // fall through to defaults
  }
  return {
    pickupAddress: `${LOCATION_DEFAULTS.churchName}, ${LOCATION_DEFAULTS.address}`,
    mapsLink: LOCATION_DEFAULTS.mapsUrl,
  };
}

const router = Router();

const DEFAULT_CHANNEL_PREFERENCES = {
  inApp: true,
  email: false,
  sms: false,
  whatsapp: false,
};

function parseChannelPreferences(raw: string | null) {
  if (!raw) return { ...DEFAULT_CHANNEL_PREFERENCES };
  try {
    const parsed = JSON.parse(raw) as Partial<typeof DEFAULT_CHANNEL_PREFERENCES>;
    return {
      inApp: parsed.inApp === true,
      email: parsed.email === true,
      sms: parsed.sms === true,
      whatsapp: parsed.whatsapp === true,
    };
  } catch {
    return { ...DEFAULT_CHANNEL_PREFERENCES };
  }
}

router.get("/notification-preferences", authMiddleware, requireRoles("parent"), async (req, res): Promise<void> => {
  const [user] = await db.select({
    communicationPrefs: usersTable.communicationPrefs,
    contactVersion: usersTable.contactVersion,
  })
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId));
  if (!user) {
    res.status(404).json({ error: "Not found", message: "User not found" });
    return;
  }
  res.json(GetNotificationPreferencesResponse.parse({
    channels: parseChannelPreferences(user.communicationPrefs),
    requiredNotificationsCannotBeDisabled: true,
    contactVersion: user.contactVersion,
  }));
});

router.put("/notification-preferences", authMiddleware, requireRoles("parent"), async (req, res): Promise<void> => {
  const parsed = UpdateNotificationPreferencesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad request", message: parsed.error.message });
    return;
  }
  const { contactVersion, ...channels } = parsed.data;
  const [updated] = await db.update(usersTable)
    .set({
      communicationPrefs: JSON.stringify(channels),
      contactVersion: sql`${usersTable.contactVersion} + 1`,
    })
    .where(and(
      eq(usersTable.id, req.user!.userId),
      eq(usersTable.contactVersion, contactVersion),
    ))
    .returning({ contactVersion: usersTable.contactVersion });
  if (!updated) {
    res.status(409).json({ error: "Conflict", message: "Notification preferences were changed; refresh and retry" });
    return;
  }
  res.json(UpdateNotificationPreferencesResponse.parse({
    channels,
    requiredNotificationsCannotBeDisabled: true,
    contactVersion: updated.contactVersion,
  }));
});

router.get("/notifications", authMiddleware, async (req, res): Promise<void> => {
  const params = ListNotificationsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: "Bad request", message: params.error.message }); return; }
  const { unreadOnly, page = 1, limit = 20 } = params.data;
  const userId = req.user!.userId;
  const conditions = [eq(notificationsTable.userId, userId)];
  if (unreadOnly) conditions.push(eq(notificationsTable.readStatus, false));
  const offset = (page - 1) * limit;
  const notifications = await db.select().from(notificationsTable)
    .where(and(...conditions))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limit).offset(offset);
  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(notificationsTable)
    .where(and(...conditions));
  const [{ unread }] = await db.select({ unread: sql<number>`count(*)` }).from(notificationsTable)
    .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.readStatus, false)));
  res.json({ data: notifications, total: Number(total), unreadCount: Number(unread), page, limit });
});

router.put("/notifications/:id/read", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [notif] = await db.update(notificationsTable).set({ readStatus: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.user!.userId))).returning();
  if (!notif) { res.status(404).json({ error: "Not found", message: "Notification not found" }); return; }
  res.json(notif);
});

router.put("/notifications/read-all", authMiddleware, async (req, res): Promise<void> => {
  await db.update(notificationsTable).set({ readStatus: true })
    .where(eq(notificationsTable.userId, req.user!.userId));
  res.json({ success: true, message: "All notifications marked as read" });
});

router.post("/notifications/broadcast", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const { title, message, targetRole, type, channel } = req.body as {
    title: string;
    message: string;
    targetRole?: string;
    type?: string;
    channel?: "in_app" | "whatsapp" | "sms" | "email";
  };
  if (!title || !message) {
    res.status(400).json({ error: "Bad request", message: "title and message are required" });
    return;
  }
  if (channel && channel !== "in_app" && channel !== "whatsapp") {
    res.status(400).json({ error: "Bad request", message: "Only in_app and whatsapp broadcast channels are currently supported" });
    return;
  }

  const roleFilter = targetRole ? eq(usersTable.role, targetRole as "super_admin" | "admin" | "teacher" | "support" | "parent") : undefined;
  const recipients = await db.select({ id: usersTable.id }).from(usersTable)
    .where(and(eq(usersTable.isActive, true), roleFilter));

  if (recipients.length === 0) {
    res.json({ success: true, sent: 0, message: "No recipients found" });
    return;
  }

  // Select first: an empty audience must never consume the rate-limit lock.
  const operation = await db.transaction(async tx => {
    await tx.execute(sql`INSERT INTO church_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
    const [settings] = await tx.select({ lastBroadcastAt: churchSettingsTable.lastBroadcastAt })
      .from(churchSettingsTable).where(eq(churchSettingsTable.id, 1)).for("update");
    return runRateLimitedAudienceOperation({
      lastOperationAt: settings?.lastBroadcastAt,
      getRecipientIds: async () => {
        // This is the authoritative audience, read while the operation lock is held.
        const rows = await tx.select({ id: usersTable.id }).from(usersTable)
          .where(and(eq(usersTable.isActive, true), roleFilter));
        return rows.map(recipient => recipient.id);
      },
      setLastOperationAt: operationAt => tx.update(churchSettingsTable)
        .set({ lastBroadcastAt: operationAt }).where(eq(churchSettingsTable.id, 1)),
      createForRecipient: async (recipientId, operationAt) => {
        const identity = `broadcast:${operationAt.toISOString()}`;
        await createNotificationDelivery(tx, {
          logicalIdentity: `${identity}:recipient:${recipientId}`,
          domainType: "broadcast", domainIdentifier: identity,
          projection: { userId: recipientId, type: type || "broadcast", title, message },
          channels: channel && channel !== "in_app" ? [channel] : ["whatsapp"], templateKey: type || "broadcast",
        });
      },
    });
  });
  if (operation.kind === "rate_limited") {
    res.status(429).json({ error: "Too many requests", message: "A broadcast was just sent. Please wait at least 60 seconds before sending another to avoid duplicate messages." });
    return;
  }
  if (operation.kind === "empty") { res.json({ success: true, sent: 0, message: "No recipients found" }); return; }

  // Push real-time SSE events so recipients' apps update instantly
  const recipientIds = operation.recipientIds;
  pushEventToUsers(recipientIds, "new_notification", { type: type || "broadcast" });

  // Also send browser push to all recipients
  pushToUsers(recipientIds, { title, body: message, icon: "/pwa-192.png", url: "/notifications" }, req.log).catch(() => {});

  res.json({ success: true, sent: recipientIds.length, message: `Notification sent to ${recipientIds.length} user(s). External delivery is queued.` });
});

router.post("/notifications/pre-dismissal", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const { serviceSlot, minutesBefore = 15 } = req.body as { serviceSlot?: string; minutesBefore?: number };

  const { pickupAddress, mapsLink } = await getPickupLocation();
  const title = "Pre-Dismissal Alert";
  const message = serviceSlot
    ? `Children in the ${serviceSlot} service will be dismissed in approximately ${minutesBefore} minutes. Please proceed to the collection area.\n\n📍 Pickup Location: ${pickupAddress}\n🗺️ Directions: ${mapsLink}`
    : `Children will be dismissed in approximately ${minutesBefore} minutes. Please proceed to the collection area.\n\n📍 Pickup Location: ${pickupAddress}\n🗺️ Directions: ${mapsLink}`;

  const parents = await db.select({ id: usersTable.id }).from(usersTable)
    .where(and(eq(usersTable.isActive, true), eq(usersTable.role, "parent")));

  if (parents.length === 0) {
    res.json({ success: true, sent: 0 });
    return;
  }

  const operation = await db.transaction(async tx => {
    await tx.execute(sql`INSERT INTO church_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
    const [settings] = await tx.select({ lastPreDismissalAt: churchSettingsTable.lastPreDismissalAt })
      .from(churchSettingsTable).where(eq(churchSettingsTable.id, 1)).for("update");
    return runRateLimitedAudienceOperation({
      lastOperationAt: settings?.lastPreDismissalAt,
      getRecipientIds: async () => {
        const rows = await tx.select({ id: usersTable.id }).from(usersTable)
          .where(and(eq(usersTable.isActive, true), eq(usersTable.role, "parent")));
        return rows.map(parent => parent.id);
      },
      setLastOperationAt: operationAt => tx.update(churchSettingsTable)
        .set({ lastPreDismissalAt: operationAt }).where(eq(churchSettingsTable.id, 1)),
      createForRecipient: async (parentId, operationAt) => {
        const identity = `pre-dismissal:${operationAt.toISOString()}:${serviceSlot ?? "all"}`;
        await createNotificationDelivery(tx, {
          logicalIdentity: `${identity}:recipient:${parentId}`, domainType: "pre_dismissal", domainIdentifier: identity,
          projection: { userId: parentId, type: "pre_dismissal", title, message, metadata: { serviceSlot, minutesBefore, pickupAddress, mapsLink } },
          channels: ["whatsapp"], templateKey: "pre_dismissal",
        });
      },
    });
  });
  if (operation.kind === "rate_limited") {
    res.status(429).json({ error: "Too many requests", message: "A pre-dismissal alert was just sent. Please wait at least 60 seconds to avoid sending it twice." });
    return;
  }
  if (operation.kind === "empty") { res.json({ success: true, sent: 0 }); return; }

  // Push real-time SSE events to all parents instantly
  pushEventToUsers(operation.recipientIds, "new_notification", { type: "pre_dismissal" });

  // Browser push to all parents
  pushToRole("parent", { title, body: message, icon: "/pwa-192.png", url: "/notifications" }, req.log).catch(() => {});

  res.json({
    success: true,
    sent: operation.recipientIds.length,
    message: `Pre-dismissal alert sent to ${operation.recipientIds.length} parent(s). External delivery is queued.`,
  });
});

// ── WhatsApp broadcast history (admin/super_admin only) ──────────────────────
router.get("/notifications/whatsapp-broadcasts", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(whatsappBroadcastsTable)
    .orderBy(desc(whatsappBroadcastsTable.createdAt))
    .limit(20);
  res.json(rows);
});

router.get("/notifications/delivery-history", authMiddleware, requireRoles("super_admin", "admin"), async (_req, res): Promise<void> => {
  const history = await db.select({
    id: notificationOutboxTable.id, notificationType: notificationOutboxTable.notificationType,
    domainType: notificationOutboxTable.domainType, domainIdentifier: notificationOutboxTable.domainIdentifier,
    recipientUserId: notificationOutboxTable.recipientUserId, channel: notificationOutboxTable.channel,
    status: notificationOutboxTable.status, attempts: notificationOutboxTable.attempts, provider: notificationOutboxTable.provider,
    failureClassification: notificationOutboxTable.failureClassification, failureDetail: notificationOutboxTable.failureDetail,
    nextAttemptAt: notificationOutboxTable.nextAttemptAt, providerAcceptedAt: notificationOutboxTable.providerAcceptedAt,
    terminal: sql<boolean>`${notificationOutboxTable.status} IN ('accepted', 'uncertain', 'skipped', 'dead_letter')`,
    safeToRetry: sql<boolean>`${notificationOutboxTable.status} = 'retryable'`,
    createdAt: notificationOutboxTable.createdAt, finalizedAt: notificationOutboxTable.finalizedAt,
  }).from(notificationOutboxTable).orderBy(desc(notificationOutboxTable.createdAt)).limit(100);
  res.json({ data: history });
});

export default router;
