import { pgTable, serial, integer, text, timestamp, pgEnum, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { childrenTable } from "./children";
import { usersTable } from "./users";

export const supportRequestTypeEnum = pgEnum("support_request_type", [
  "checkin",
  "checkout",
  "delegate_pickup",
]);

export const supportRequestStatusEnum = pgEnum("support_request_status", [
  "pending",
  "photo_sent",
  "approved",
  "rejected",
  "completed",
]);

export const supportRequestsTable = pgTable("support_requests", {
  id: serial("id").primaryKey(),
  referenceNumber: text("reference_number").notNull().unique(),
  type: supportRequestTypeEnum("type").notNull(),
  childId: integer("child_id").notNull().references(() => childrenTable.id),
  parentUserId: integer("parent_user_id").notNull().references(() => usersTable.id),
  assignedSupportId: integer("assigned_support_id").references(() => usersTable.id),
  status: supportRequestStatusEnum("status").notNull().default("pending"),
  serviceDate: date("service_date").notNull(),
  serviceSlot: text("service_slot").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSupportRequestSchema = createInsertSchema(supportRequestsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSupportRequest = z.infer<typeof insertSupportRequestSchema>;
export type SupportRequest = typeof supportRequestsTable.$inferSelect;
