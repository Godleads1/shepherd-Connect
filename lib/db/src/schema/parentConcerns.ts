import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { childrenTable } from "./children";

export const concernTypeEnum = pgEnum("concern_type", [
  "safeguarding_concern",
  "complaint",
  "compliment",
  "general_feedback",
]);

export const concernStatusEnum = pgEnum("concern_status", [
  "open",
  "under_review",
  "assessment",
  "parent_notified",
  "escalated",
  "resolved",
  "closed",
]);

export const parentConcernsTable = pgTable("parent_concerns", {
  id: serial("id").primaryKey(),
  referenceNumber: text("reference_number").notNull().unique(),
  parentUserId: integer("parent_user_id").notNull().references(() => usersTable.id),
  childId: integer("child_id").references(() => childrenTable.id),
  type: concernTypeEnum("type").notNull(),
  description: text("description").notNull(),
  status: concernStatusEnum("status").notNull().default("open"),
  adminNotes: text("admin_notes"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertParentConcernSchema = createInsertSchema(parentConcernsTable).omit({
  id: true,
  referenceNumber: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertParentConcern = z.infer<typeof insertParentConcernSchema>;
export type ParentConcern = typeof parentConcernsTable.$inferSelect;
