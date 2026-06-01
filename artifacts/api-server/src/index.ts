import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler } from "./lib/scheduler";
import { initWhatsApp, closeWhatsAppClean } from "./services/whatsapp";

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
const _shutdown = () => {
  logger.info("Graceful shutdown — closing WhatsApp socket");
  closeWhatsAppClean()
    .catch(() => { /* ignore */ })
    .finally(() => process.exit(0));
  // Force exit after 3 s if cleanup stalls
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on("SIGTERM", _shutdown);
process.on("SIGINT", _shutdown);

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startScheduler();
  initWhatsApp().catch(() => { /* no session yet — admin will connect via Settings */ });
});
