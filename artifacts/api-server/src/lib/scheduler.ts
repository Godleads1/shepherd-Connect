import cron from "node-cron";
import { eq, and } from "drizzle-orm";
import {
  db,
  pickupDelegatesTable,
  familiesTable,
  childrenTable,
  usersTable,
  teacherAllocationsTable,
  teachersTable,
  staffScansTable,
} from "@workspace/db";
import { logger } from "./logger";
import { sendNotification } from "./notify";

// WAT = UTC+1. All cron expressions below are in UTC.
const SUNDAY_CHECKPOINTS = [
  { cron: "0 6 * * 0",  label: "7:00 AM",  service: "1st" as const, slot: "7am" },
  { cron: "30 7 * * 0", label: "8:30 AM",  service: "1st" as const, slot: "7am" },
  { cron: "30 8 * * 0", label: "9:30 AM",  service: "1st" as const, slot: "7am" },
  { cron: "0 9 * * 0",  label: "10:00 AM", service: "2nd" as const, slot: "10:30am" },
  { cron: "0 10 * * 0", label: "11:00 AM", service: "2nd" as const, slot: "10:30am" },
  { cron: "0 11 * * 0", label: "12:00 PM", service: "2nd" as const, slot: "10:30am" },
] as const;

// Clock-out reminders (WAT): 9:45 after 1st service, 12:15 after 2nd service
const CLOCK_OUT_REMINDERS = [
  { cron: "45 8 * * 0",  service: "1st" as const, label: "1st Service" },
  { cron: "15 11 * * 0", service: "2nd" as const, label: "2nd Service" },
] as const;

/** Get the set of userIds for staff scheduled for a given serviceSlot on today's Sunday */
async function getScheduledUserIds(today: string, slot: "7am" | "10:30am"): Promise<Set<number>> {
  const rows = await db
    .select({ userId: teachersTable.userId })
    .from(teacherAllocationsTable)
    .innerJoin(teachersTable, eq(teachersTable.id, teacherAllocationsTable.teacherId))
    .where(
      and(
        eq(teacherAllocationsTable.serviceDate, today),
        eq(teacherAllocationsTable.serviceSlot, slot)
      )
    );
  return new Set(rows.map(r => r.userId));
}

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

  // Sunday attendance checkpoint notifications (service-aware)
  for (const checkpoint of SUNDAY_CHECKPOINTS) {
    cron.schedule(checkpoint.cron, async () => {
      logger.info(
        { interval: checkpoint.label, service: checkpoint.service },
        "scheduler: Sunday attendance checkpoint — sending notifications"
      );
      try {
        const today = new Date().toISOString().slice(0, 10);
        const allUsers = await db
          .select({ id: usersTable.id, role: usersTable.role })
          .from(usersTable)
          .where(eq(usersTable.isActive, true));

        // Get teachers allocated to the OTHER service slot for this checkpoint.
        // Those teachers should NOT be notified (they're scheduled for the other service).
        const oppositeSlot = checkpoint.slot === "7am" ? "10:30am" : "7am";
        const oppositeOnlyIds = await getScheduledUserIds(today, oppositeSlot);
        // Also check if they have an allocation for THIS slot (meaning they serve both)
        const thisSlotIds = await getScheduledUserIds(today, checkpoint.slot);

        const recipients = allUsers.filter(u => {
          if (!["teacher", "support", "attendant"].includes(u.role as string)) return false;
          if (u.role !== "teacher") return true; // support/attendant always notified
          // Teacher: notify if they have this slot OR no allocation at all
          const inOppositeOnly = oppositeOnlyIds.has(u.id) && !thisSlotIds.has(u.id);
          return !inOppositeOnly;
        });

        for (const member of recipients) {
          await sendNotification({
            userId: member.id,
            type: "info",
            title: `📍 ${checkpoint.label} Attendance Check-in`,
            message: `Time to scan the attendance QR code for the ${checkpoint.service} service. Open the app → Service Attendance.`,
          });
        }

        logger.info(
          { count: recipients.length, interval: checkpoint.label },
          "scheduler: attendance check-in notifications sent"
        );
      } catch (err) {
        logger.error(
          { err, interval: checkpoint.label },
          "scheduler: attendance notification failed"
        );
      }
    });
  }

  // Clock-out reminders — only send to staff who have scanned today for that service
  for (const reminder of CLOCK_OUT_REMINDERS) {
    cron.schedule(reminder.cron, async () => {
      logger.info(
        { service: reminder.service },
        "scheduler: clock-out reminder — sending notifications"
      );
      try {
        const today = new Date().toISOString().slice(0, 10);

        // Find staff who scanned checkpoints for this service today but haven't clocked out
        const todayScans = await db
          .select()
          .from(staffScansTable)
          .where(eq(staffScansTable.serviceDate, today));

        const serviceScans = todayScans.filter(
          s => s.service === reminder.service && s.scanType === "checkpoint"
        );
        const alreadyOut = new Set(
          todayScans
            .filter(s => s.service === reminder.service && (s.scanType === "clock_out" || s.scanType === "emergency_out"))
            .map(s => s.userId)
        );

        const toNotify = new Set(
          serviceScans
            .filter(s => !alreadyOut.has(s.userId))
            .map(s => s.userId)
        );

        for (const userId of toNotify) {
          await sendNotification({
            userId,
            type: "info",
            title: `🔔 Clock Out — ${reminder.label}`,
            message: `The ${reminder.label} has ended. Please clock out on the Service Attendance page. God bless you for serving!`,
          });
        }

        logger.info(
          { count: toNotify.size, service: reminder.service },
          "scheduler: clock-out reminders sent"
        );
      } catch (err) {
        logger.error(
          { err, service: reminder.service },
          "scheduler: clock-out reminder failed"
        );
      }
    });
  }

  logger.info(
    "scheduler: started (Sunday cleanup + 6 check-in notifications + 2 clock-out reminders)"
  );
}
