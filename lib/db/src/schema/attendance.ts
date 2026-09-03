import { pgTable, serial, integer, date, text, timestamp, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { childrenTable } from "./children";
import { classesTable } from "./classes";
import { usersTable } from "./users";
import { custodyEpisodesTable } from "./custodyEpisodes";

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
  custodyEpisodeId: integer("custody_episode_id").references(() => custodyEpisodesTable.id),
  status: attendanceStatusEnum("status").notNull().default("dropped_off"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  // Legacy rows retain the prior one-row-per-slot invariant. Custody-backed
  // rows are per episode, allowing a pickup and later physical return to be
  // recorded as a distinct custody and service-presence interval.
  uniqueIndex("uq_attendance_legacy_child_slot").on(t.childId, t.serviceDate, t.serviceSlot)
    .where(sql`${t.custodyEpisodeId} IS NULL`),
  uniqueIndex("uq_attendance_child_slot_episode").on(t.childId, t.serviceDate, t.serviceSlot, t.custodyEpisodeId)
    .where(sql`${t.custodyEpisodeId} IS NOT NULL`),
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
