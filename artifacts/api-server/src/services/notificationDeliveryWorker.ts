import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import {
  claimNotifications, finalizeNotification, type ClaimedNotification,
} from "./notificationOutbox";
import { logger } from "../lib/logger";
import { deliverOutboxEmail, deliverOutboxSms, type OutboxProviderOutcome } from "./sms";
import { ObjectStorageService } from "../lib/objectStorage";

const POLL_MS = 5_000;
const BATCH_SIZE = 20;
let timer: ReturnType<typeof setInterval> | undefined;
let running = false;
const objectStorage = new ObjectStorageService();

type AuthoritativeDelivery = {
  phone: string | null; email: string | null; communicationPrefs: string | null;
  title: string; message: string;
};

function preferenceEnabled(raw: string | null, channel: string): boolean {
  try { return Boolean(raw && (JSON.parse(raw) as Record<string, unknown>)[channel]); } catch { return false; }
}

export function isRequiredSafetyOrCustodyNotification(notificationType: string): boolean {
  return [
    "emergency_",
    "missing_child",
    "custody_",
    "pickup_",
    "delegate_",
    "drop_off_",
  ].some(prefix => notificationType.startsWith(prefix));
}

function escapeEmailHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

async function loadDelivery(row: ClaimedNotification): Promise<AuthoritativeDelivery | undefined> {
  let notificationId: number | undefined;
  try { notificationId = Number((JSON.parse(row.payloadJson) as { notificationId?: number }).notificationId); } catch { /* finalized below */ }
  if (!Number.isSafeInteger(notificationId) || notificationId! < 1) return undefined;
  const result = await db.execute(sql`
    SELECT u.phone, u.email, u.communication_prefs AS "communicationPrefs", n.title, n.message
    FROM notifications n JOIN users u ON u.id = n.user_id
    WHERE n.id = ${notificationId} AND n.user_id = ${row.recipientUserId}
      AND u.is_active = true AND u.status = 'active'
  `);
  return result.rows[0] as AuthoritativeDelivery | undefined;
}

async function process(row: ClaimedNotification): Promise<void> {
  const delivery = await loadDelivery(row);
  if (!delivery) {
    await finalizeNotification(db, { ...row, outcome: "skipped", failureClassification: "recipient_or_notification_missing" });
    return;
  }
  // WhatsApp has always been opt-in through communicationPrefs. Required SMS
  // and email consequences historically sent regardless of a null preference
  // document, so preserving them must not turn a missing JSON blob into opt-out.
  const requiredByExistingPolicy = isRequiredSafetyOrCustodyNotification(row.notificationType) || [
    "support_request_assigned",
    "delegate_photo_approval",
    "support_request_approved",
    "support_request_rejected",
  ].includes(row.notificationType);
  if (!requiredByExistingPolicy && !preferenceEnabled(delivery.communicationPrefs, row.channel)) {
    await finalizeNotification(db, { ...row, outcome: "skipped", failureClassification: "preference_disabled" });
    return;
  }
  const contact = row.channel === "email" ? delivery.email : delivery.phone;
  if (!contact?.trim()) {
    await finalizeNotification(db, { ...row, outcome: "skipped", failureClassification: "missing_contact" });
    return;
  }
  if (row.channel === "sms") {
    await finalizeProviderOutcome(row, await deliverOutboxSms(contact, `*${delivery.title}*\n\n${delivery.message}`, logger));
    return;
  }
  if (row.channel === "email") {
    // The content is stored authoritatively in notifications, not in the
    // outbox payload. This small wrapper deliberately carries no credentials
    // or raw provider response into delivery history.
    const html = `<h2>${escapeEmailHtml(delivery.title)}</h2><p>${escapeEmailHtml(delivery.message).replace(/\n/g, "<br>")}</p>`;
    await finalizeProviderOutcome(row, await deliverOutboxEmail(contact, delivery.title, html, logger));
    return;
  }
  // Provider calls are deliberately outside a DB transaction. Baileys only
  // confirms acceptance; it cannot establish handset delivery.
  const { getWhatsAppState, sendWhatsAppMessage } = await import("./whatsapp");
  if (!getWhatsAppState().connected) {
    await finalizeNotification(db, { ...row, outcome: "retryable", failureClassification: "provider_unavailable", failureDetail: "WhatsApp is not connected", provider: "baileys" });
    return;
  }
  try {
    let imageObjectPath: string | undefined;
    try {
      const metadata = JSON.parse(row.templateMetadataJson) as { imageObjectPath?: unknown };
      if (typeof metadata.imageObjectPath === "string" && metadata.imageObjectPath.startsWith("/objects/")) {
        imageObjectPath = metadata.imageObjectPath;
      }
    } catch { /* ordinary text delivery */ }
    const accepted = imageObjectPath
      ? await (async () => {
          const { sendWhatsAppImageToJid } = await import("./whatsapp");
          const file = await objectStorage.getObjectEntityFile(imageObjectPath);
          const [image] = await file.download();
          const digits = contact.replace(/\D/g, "");
          return sendWhatsAppImageToJid(`${digits}@s.whatsapp.net`, image, `*${delivery.title}*\n\n${delivery.message}`);
        })()
      : await sendWhatsAppMessage(contact, `*${delivery.title}*\n\n${delivery.message}`);
    if (accepted) {
      await finalizeNotification(db, { ...row, outcome: "accepted", provider: "baileys", providerAcceptedAt: new Date() });
    } else {
      // A false response follows a submission attempt but does not safely tell
      // us whether the provider accepted it: do not retry or switch provider.
      await finalizeNotification(db, { ...row, outcome: "uncertain", failureClassification: "provider_ambiguous_response", provider: "baileys" });
    }
  } catch (error) {
    await finalizeNotification(db, { ...row, outcome: "uncertain", failureClassification: "provider_exception_after_submission", failureDetail: error, provider: "baileys" });
  }
}

async function finalizeProviderOutcome(row: ClaimedNotification, result: OutboxProviderOutcome): Promise<void> {
  await finalizeNotification(db, {
    ...row,
    outcome: result.outcome,
    provider: result.provider,
    providerMessageId: result.providerMessageId,
    failureClassification: result.failureClassification,
    failureDetail: result.failureDetail,
    providerAcceptedAt: result.outcome === "accepted" ? new Date() : undefined,
  });
}

export async function pollNotificationOutbox(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const claimed = await claimNotifications(db, { limit: BATCH_SIZE });
    for (const row of claimed) {
      try { await process(row); } catch (error) {
        logger.error({ outboxId: row.id, error }, "notification outbox worker failed to finalize claimed row");
        await finalizeNotification(db, { ...row, outcome: "retryable", failureClassification: "worker_error", failureDetail: error }).catch(() => {});
      }
    }
  } finally {
    running = false;
  }
}

export function startNotificationDeliveryWorker(): void {
  if (timer) return;
  timer = setInterval(() => { void pollNotificationOutbox(); }, POLL_MS);
  timer.unref();
  void pollNotificationOutbox();
}

export function stopNotificationDeliveryWorker(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}

export const TERMINAL_OUTBOX_RETENTION_DAYS = 90;
export const SSE_TICKET_RETENTION_DAYS = 1;

/** Bounded retention for delivery coordination data; projections remain user-visible history. */
export async function cleanupNotificationDeliveryHistory(): Promise<{ outbox: number; tickets: number }> {
  const outbox = await db.execute(sql`
    DELETE FROM notification_outbox
    WHERE status IN ('accepted', 'uncertain', 'skipped', 'dead_letter')
      AND finalized_at < now() - (${TERMINAL_OUTBOX_RETENTION_DAYS} * interval '1 day')
    RETURNING id
  `);
  const tickets = await db.execute(sql`
    DELETE FROM sse_tickets
    WHERE expires_at < now() - (${SSE_TICKET_RETENTION_DAYS} * interval '1 day')
       OR (consumed_at IS NOT NULL AND consumed_at < now() - (${SSE_TICKET_RETENTION_DAYS} * interval '1 day'))
    RETURNING ticket_hash
  `);
  return { outbox: outbox.rows.length, tickets: tickets.rows.length };
}