import { pgTable, serial, integer, date, text, timestamp, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { childrenTable } from "./children";
import { classesTable } from "./classes";
import { usersTable } from "./users";

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "dropped_off",
  "in_transit",
  "in_class",
  "picked_up",
]);

export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull().references(() => childrenTable.id),
  classId: integer("class_id").notNull().references(() => classesTable.id),
  serviceDate: date("service_date").notNull(),
  serviceSlot: text("service_slot").notNull(),
  checkInTime: timestamp("check_in_time"),
  escortTime: timestamp("escort_time"),
  classArrivalTime: timestamp("class_arrival_time"),
  checkOutTime: timestamp("check_out_time"),
  checkedInBy: integer("checked_in_by").references(() => usersTable.id),
  escortedBy: integer("escorted_by").references(() => usersTable.id),
  confirmedByTeacherId: integer("confirmed_by_teacher_id").references(() => usersTable.id),
  checkedOutBy: integer("checked_out_by").references(() => usersTable.id),
  status: attendanceStatusEnum("status").notNull().default("dropped_off"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  // A child can only have one attendance record per service slot per day
  uniqueIndex("uq_attendance_child_slot").on(t.childId, t.serviceDate, t.serviceSlot),
]);

export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({
  id: true,
  createdAt: true,
  checkInTime: true,
  escortTime: true,
  checkOutTime: true,
  checkedInBy: true,
  escortedBy: true,
  checkedOutBy: true,
});

export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendanceTable.$inferSelect;
