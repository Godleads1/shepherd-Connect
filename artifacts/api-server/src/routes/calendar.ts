import { Router } from "express";
import { db, classesTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

function toICalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function getNextSunday(serviceHour: number): Date {
  const now = new Date();
  // If today IS Sunday, use today; otherwise advance to the next Sunday
  const daysUntilSunday = now.getDay() === 0 ? 0 : (7 - now.getDay()) % 7;
  const d = new Date(now);
  d.setDate(d.getDate() + daysUntilSunday);
  d.setHours(serviceHour, 0, 0, 0);
  return d;
}

router.get("/calendar/classes.ics", async (req, res): Promise<void> => {
  try {
    const classes = await db.select().from(classesTable);

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Shepherd Connect//RCCG City of David//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Shepherd Connect – Church Classes",
      "X-WR-CALDESC:RCCG City of David children's ministry class schedule",
      "X-WR-TIMEZONE:Africa/Lagos",
    ];

    const SERVICE_SLOTS = [
      { label: "1st Service", hour: 7, durationHours: 3 },
      { label: "2nd Service", hour: 10, durationHours: 3 },
    ];

    for (const cls of classes) {
      for (const slot of SERVICE_SLOTS) {
        const start = getNextSunday(slot.hour);
        const end = new Date(start.getTime() + slot.durationHours * 60 * 60 * 1000);
        const uid = `shepherd-${cls.id}-${slot.label.replace(/\s/g, "").toLowerCase()}@shepherdconnect.rccg`;

        lines.push(
          "BEGIN:VEVENT",
          `UID:${uid}`,
          `DTSTART:${toICalDate(start)}`,
          `DTEND:${toICalDate(end)}`,
          `RRULE:FREQ=WEEKLY;BYDAY=SU`,
          `SUMMARY:${cls.name} – ${slot.label}`,
          `DESCRIPTION:Shepherd Connect class: ${cls.name}\\n${slot.label} (${slot.hour}:00 – ${slot.hour + slot.durationHours}:00)`,
          `LOCATION:RCCG City of David`,
          "END:VEVENT",
        );
      }
    }

    lines.push("END:VCALENDAR");

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="shepherd-connect-classes.ics"',
    );
    res.setHeader("Cache-Control", "no-cache");
    res.send(lines.join("\r\n"));
  } catch (err) {
    logger.error({ err }, "Failed to generate calendar feed");
    res.status(500).json({ error: "Failed to generate calendar" });
  }
});

export default router;
