import cron from "node-cron";
import { eq } from "drizzle-orm";
import { db, pickupDelegatesTable, familiesTable, childrenTable } from "@workspace/db";
import { logger } from "./logger";

export function startScheduler() {
  // Every Sunday at 15:00 (3 pm server time):
  //   1. Delete all pickup delegates (clean for next service)
  //   2. Delete all guest families + their children
  cron.schedule("0 15 * * 0", async () => {
    logger.info("scheduler: Sunday 3 pm — running service cleanup");
    try {
      const delegates = await db.delete(pickupDelegatesTable).returning({ id: pickupDelegatesTable.id });
      logger.info({ deleted: delegates.length }, "scheduler: pickup delegates cleared");
    } catch (err) {
      logger.error({ err }, "scheduler: failed to clear pickup delegates");
    }
    try {
      const guestFamilies = await db.select({ id: familiesTable.id })
        .from(familiesTable).where(eq(familiesTable.isGuest, true));
      for (const fam of guestFamilies) {
        await db.delete(childrenTable).where(eq(childrenTable.familyId, fam.id));
      }
      const deleted = await db.delete(familiesTable).where(eq(familiesTable.isGuest, true))
        .returning({ id: familiesTable.id });
      logger.info({ deleted: deleted.length }, "scheduler: guest families cleared");
    } catch (err) {
      logger.error({ err }, "scheduler: failed to clear guest families");
    }
  });

  logger.info("scheduler: started (Sunday 15:00 delegate + guest cleanup)");
}
