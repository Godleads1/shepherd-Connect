import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { childrenTable } from "./children";
import { classesTable } from "./classes";
import { usersTable } from "./users";

export const classChangeRequestStatusEnum = pgEnum("class_change_request_status", [
  "pending",
  "approved",
  "rejected",
]);

export const classChangeRequestsTable = pgTable("class_change_requests", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull().references(() => childrenTable.id),
  currentClassId: integer("current_class_id").references(() => classesTable.id),
  requestedClassId: integer("requested_class_id").notNull().references(() => classesTable.id),
  reason: text("reason"),
  status: classChangeRequestStatusEnum("status").notNull().default("pending"),
  requestedBy: integer("requested_by").notNull().references(() => usersTable.id),
  reviewedBy: integer("reviewed_by").references(() => usersTable.id),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertClassChangeRequestSchema = createInsertSchema(classChangeRequestsTable).omit({
  id: true,
  status: true,
  requestedBy: true,
  reviewedBy: true,
  adminNotes: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertClassChangeRequest = z.infer<typeof insertClassChangeRequestSchema>;
export type ClassChangeRequest = typeof classChangeRequestsTable.$inferSelect;
