import "./lib/forceUtc";
import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler } from "./lib/scheduler";
import { initWhatsApp, closeWhatsAppClean } from "./services/whatsapp";
import { startNotificationDeliveryWorker, stopNotificationDeliveryWorker } from "./services/notificationDeliveryWorker";
import { migrateLegacyWhatsAppQueue } from "./lib/whatsapp-queue";
import { backfillLegacyPhoneIdentities } from "./lib/phase6Rollout";
import { getChurchProfile, invalidateChurchProfile } from "./lib/churchProfile";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Gracefully close the WhatsApp socket on shutdown so WhatsApp sees a clean
// disconnect (not an abrupt TCP drop which triggers session invalidation / 401).
let shuttingDown = false;
const _shutdown = (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  stopNotificationDeliveryWorker();
  logger.info("Graceful shutdown — closing WhatsApp socket");
  closeWhatsAppClean()
    .catch(() => { /* ignore */ })
    .finally(() => process.exit(code));
  // Force exit after 3 s if cleanup stalls
  setTimeout(() => process.exit(code), 3000).unref();
};
process.on("SIGTERM", () => _shutdown(0));
process.on("SIGINT", () => _shutdown(0));

// A stray rejected promise in a background task (timer, socket event) must not
// take every family's session down with it. Log it loudly and keep serving.
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection (process kept running)");
});
// A synchronous uncaught exception leaves the process in an unknown state, so
// exit — but cleanly, so WhatsApp gets a proper disconnect, and let the host
// restart it.
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception — shutting down");
  _shutdown(1);
});

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  // Keep the church profile (name, services) warm for code that reads it synchronously.
  void getChurchProfile();
  setInterval(() => { invalidateChurchProfile(); void getChurchProfile(); }, 60_000).unref();
  startScheduler();
  initWhatsApp().catch(() => { /* no session yet — admin will connect via Settings */ });
  // No outbox polling may begin until every legacy pending recipient has an
  // idempotent outbox representation (or startup fails loudly).
  try {
    await migrateLegacyWhatsAppQueue();
    await backfillLegacyPhoneIdentities();
  } catch (startupError) {
    logger.fatal({ err: startupError }, "Startup migration failed — exiting so the host can retry");
    _shutdown(1);
    return;
  }
  startNotificationDeliveryWorker();
});
