import { date, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { attendanceTable } from "./attendance";
import { usersTable } from "./users";

export const attendanceEventsTable = pgTable("attendance_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  eventId: text("event_id").notNull(),
  operation: text("operation").notNull(),
  attendanceId: integer("attendance_id").references(() => attendanceTable.id),
  serviceDate: date("service_date").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("uq_attendance_events_user_event_operation").on(t.userId, t.eventId, t.operation),
]);

export type AttendanceEvent = typeof attendanceEventsTable.$inferSelect;