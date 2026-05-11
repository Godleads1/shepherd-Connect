import { pgTable, serial, integer, text, date, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { classesTable } from "./classes";

export const substituteStatusEnum = pgEnum("substitute_status", [
  "pending",
  "assigned",
  "confirmed",
  "cancelled",
]);

export const substituteRequestsTable = pgTable("substitute_requests", {
  id: serial("id").primaryKey(),
  requestingTeacherId: integer("requesting_teacher_id").notNull().references(() => usersTable.id),
  substituteTeacherId: integer("substitute_teacher_id").references(() => usersTable.id),
  classId: integer("class_id").references(() => classesTable.id),
  serviceDate: date("service_date").notNull(),
  reason: text("reason").notNull(),
  status: substituteStatusEnum("status").notNull().default("pending"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSubstituteRequestSchema = createInsertSchema(substituteRequestsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  substituteTeacherId: true,
  adminNotes: true,
  status: true,
});

export type InsertSubstituteRequest = z.infer<typeof insertSubstituteRequestSchema>;
export type SubstituteRequest = typeof substituteRequestsTable.$inferSelect;
