import cron from "node-cron";
import { eq } from "drizzle-orm";
import { db, pickupDelegatesTable, familiesTable, childrenTable, usersTable } from "@workspace/db";
import { logger } from "./logger";
import { sendNotification } from "./notify";

// WAT = UTC+1. All cron expressions below are in UTC.
const SUNDAY_CHECKPOINTS = [
  { cron: "0 6 * * 0",  label: "7:00 AM",  service: "1st" },
  { cron: "30 7 * * 0", label: "8:30 AM",  service: "1st" },
  { cron: "30 8 * * 0", label: "9:30 AM",  service: "1st" },
  { cron: "0 9 * * 0",  label: "10:00 AM", service: "2nd" },
  { cron: "0 10 * * 0", label: "11:00 AM", service: "2nd" },
  { cron: "0 11 * * 0", label: "12:00 PM", service: "2nd" },
] as const;

export function startScheduler() {
  // Every Sunday at 15:00 WAT (14:00 UTC):
  //   1. Delete all pickup delegates (clean for next service)
  //   2. Delete all guest families + their children
  cron.schedule("0 14 * * 0", async () => {
    logger.info("scheduler: Sunday 3 pm WAT — running service cleanup");
    try {
      const delegates = await db
        .delete(pickupDelegatesTable)
        .returning({ id: pickupDelegatesTable.id });
      logger.info({ deleted: delegates.length }, "scheduler: pickup delegates cleared");
    } catch (err) {
      logger.error({ err }, "scheduler: failed to clear pickup delegates");
    }
    try {
      const guestFamilies = await db
        .select({ id: familiesTable.id })
        .from(familiesTable)
        .where(eq(familiesTable.isGuest, true));
      for (const fam of guestFamilies) {
        await db.delete(childrenTable).where(eq(childrenTable.familyId, fam.id));
      }
      const deleted = await db
        .delete(familiesTable)
        .where(eq(familiesTable.isGuest, true))
        .returning({ id: familiesTable.id });
      logger.info({ deleted: deleted.length }, "scheduler: guest families cleared");
    } catch (err) {
      logger.error({ err }, "scheduler: failed to clear guest families");
    }
  });

  // Sunday attendance checkpoint notifications
  for (const checkpoint of SUNDAY_CHECKPOINTS) {
    cron.schedule(checkpoint.cron, async () => {
      logger.info(
        { interval: checkpoint.label, service: checkpoint.service },
        "scheduler: Sunday attendance checkpoint — sending notifications"
      );
      try {
        const allUsers = await db
          .select({ id: usersTable.id, role: usersTable.role })
          .from(usersTable)
          .where(eq(usersTable.isActive, true));

        const staff = allUsers.filter(u =>
          ["teacher", "support", "attendant"].includes(u.role as string)
        );

        for (const member of staff) {
          await sendNotification({
            userId: member.id,
            type: "info",
            title: `📍 ${checkpoint.label} Attendance Checkpoint`,
            message: `Please scan the QR code on the church wall to record your presence for the ${checkpoint.service} service.`,
          });
        }

        logger.info(
          { count: staff.length, interval: checkpoint.label },
          "scheduler: attendance notifications sent"
        );
      } catch (err) {
        logger.error(
          { err, interval: checkpoint.label },
          "scheduler: attendance notification failed"
        );
      }
    });
  }

  logger.info(
    "scheduler: started (Sunday cleanup + 6 attendance checkpoint notifications)"
  );
}
