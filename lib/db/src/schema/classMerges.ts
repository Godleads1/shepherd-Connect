import { pgTable, serial, integer, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { classesTable, serviceSlotEnum } from "./classes";
import { usersTable } from "./users";

/**
 * Records a Sunday where one class's children physically join another class's room.
 * sourceClassId = the class being absorbed (e.g. Age 1)
 * targetClassId = the host class (e.g. Age 2)
 *
 * When a pickup request or en-route notification fires for a child in sourceClassId,
 * the system routes it to targetClassId's teachers instead.
 * serviceSlot = null means the merge applies to both service slots.
 */
export const classMergesTable = pgTable("class_merges", {
  id: serial("id").primaryKey(),
  sourceClassId: integer("source_class_id").notNull().references(() => classesTable.id),
  targetClassId: integer("target_class_id").notNull().references(() => classesTable.id),
  serviceDate: date("service_date").notNull(),
  serviceSlot: serviceSlotEnum("service_slot"), // null = both slots
  createdBy: integer("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertClassMergeSchema = createInsertSchema(classMergesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertClassMerge = z.infer<typeof insertClassMergeSchema>;
export type ClassMerge = typeof classMergesTable.$inferSelect;
