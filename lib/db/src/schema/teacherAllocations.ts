import { pgTable, serial, integer, date, text, timestamp, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teachersTable } from "./teachers";
import { classesTable } from "./classes";

export const allocationStatusEnum = pgEnum("allocation_status", [
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
]);

export const teacherAllocationsTable = pgTable("teacher_allocations", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id),
  classId: integer("class_id").notNull().references(() => classesTable.id),
  serviceDate: date("service_date").notNull(),
  serviceSlot: text("service_slot").notNull(),
  status: allocationStatusEnum("status").notNull().default("scheduled"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  // Prevent two allocations for the same teacher in the same service slot
  uniqueIndex("uq_teacher_alloc_slot").on(t.teacherId, t.serviceDate, t.serviceSlot),
]);

export const insertTeacherAllocationSchema = createInsertSchema(teacherAllocationsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertTeacherAllocation = z.infer<typeof insertTeacherAllocationSchema>;
export type TeacherAllocation = typeof teacherAllocationsTable.$inferSelect;
