import cron from "node-cron";
import { db, pickupDelegatesTable } from "@workspace/db";
import { logger } from "./logger";

export function startScheduler() {
  // Every Sunday at 15:00 (3 pm server time) — expire all delegate OTPs
  // and delete delegate records so the list is clean for the next service.
  // Cron syntax: second minute hour day-of-month month day-of-week
  //              0      0      15   *              *     0 (Sunday)
  cron.schedule("0 15 * * 0", async () => {
    logger.info("scheduler: Sunday 3 pm — clearing expired pickup delegates");
    try {
      const result = await db.delete(pickupDelegatesTable).returning({ id: pickupDelegatesTable.id });
      logger.info({ deleted: result.length }, "scheduler: pickup delegates cleared");
    } catch (err) {
      logger.error({ err }, "scheduler: failed to clear pickup delegates");
    }
  });

  logger.info("scheduler: started (Sunday 15:00 delegate cleanup)");
}
