import { pgTable, serial, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { childrenTable } from "./children";
import { classesTable } from "./classes";
import { usersTable } from "./users";

export const assignmentStatusEnum = pgEnum("assignment_status", ["active", "pending", "inactive"]);

export const classAssignmentsTable = pgTable("class_assignments", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull().references(() => childrenTable.id),
  classId: integer("class_id").notNull().references(() => classesTable.id),
  assignedBy: integer("assigned_by").references(() => usersTable.id),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
  status: assignmentStatusEnum("status").notNull().default("active"),
});

export const insertClassAssignmentSchema = createInsertSchema(classAssignmentsTable).omit({
  id: true,
  assignedAt: true,
});

export type InsertClassAssignment = z.infer<typeof insertClassAssignmentSchema>;
export type ClassAssignment = typeof classAssignmentsTable.$inferSelect;
