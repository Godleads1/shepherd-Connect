import { pgTable, serial, integer, timestamp, real, boolean, text, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const teacherClockInsTable = pgTable("teacher_clock_ins", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  serviceDate: text("service_date").notNull(),
  clockInAt: timestamp("clock_in_at"),
  clockOutAt: timestamp("clock_out_at"),
  clockInLat: real("clock_in_lat"),
  clockInLng: real("clock_in_lng"),
  isOnTime: boolean("is_on_time"),
  isWithinGeofence: boolean("is_within_geofence").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("teacher_clock_ins_user_date_unique").on(table.userId, table.serviceDate),
]);

export const insertTeacherClockInSchema = createInsertSchema(teacherClockInsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertTeacherClockIn = z.infer<typeof insertTeacherClockInSchema>;
export type TeacherClockIn = typeof teacherClockInsTable.$inferSelect;
