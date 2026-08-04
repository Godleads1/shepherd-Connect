import { logger } from "./logger";
import { dispatchExternal } from "./notify";

/**
 * Sends WhatsApp/SMS notifications to a list of recipients at a controlled
 * rate to avoid triggering WhatsApp's spam/ban detection.
 *
 * Safe rate for the unofficial Baileys API is ~5 messages/second.
 * We use 220 ms between each send (≈ 4.5/s) with a small buffer.
 *
 * This function returns immediately — delivery happens in the background.
 * Results are logged to the server logger; callers do not await delivery.
 *
 * @param recipients  Array of user IDs to notify
 * @param title       Notification title
 * @param message     Notification body
 * @param context     Short label for log lines (e.g. "broadcast", "pre-dismissal")
 * @param delayMs     Gap between sends in ms (default 220)
 */
export function enqueueWhatsAppBroadcast(
  recipients: { id: number }[],
  title: string,
  message: string,
  context: string,
  delayMs = 220,
): void {
  if (recipients.length === 0) return;

  // Fire-and-forget — do NOT await this in the route handler.
  (async () => {
    let delivered = 0;
    let failed = 0;

    for (const recipient of recipients) {
      try {
        const result = await dispatchExternal(recipient.id, title, message);
        if (result.delivered) delivered++;
        else failed++;
      } catch {
        failed++;
      }

      // Throttle: wait between sends to avoid WhatsApp rate-limiting/banning.
      // Skip the delay after the last message.
      if (recipient !== recipients[recipients.length - 1]) {
        await new Promise<void>(resolve => setTimeout(resolve, delayMs));
      }
    }

    const total = recipients.length;
    const durationSec = ((total - 1) * delayMs) / 1000;

    if (failed > 0) {
      logger.warn(
        { context, delivered, failed, total, durationSec },
        `${context}: WhatsApp queue finished — some deliveries failed`,
      );
    } else {
      logger.info(
        { context, delivered, total, durationSec },
        `${context}: WhatsApp queue finished — all delivered`,
      );
    }
  })();
}
