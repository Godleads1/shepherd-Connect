import { pgTable, serial, integer, text, date, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const dbsStatusEnum = pgEnum("dbs_status", [
  "clear",
  "pending",
  "expired",
  "not_submitted",
]);

export const safeguardingRecordsTable = pgTable("safeguarding_records", {
  id: serial("id").primaryKey(),
  teacherUserId: integer("teacher_user_id").notNull().references(() => usersTable.id),
  checkType: text("check_type").notNull(),
  referenceNumber: text("reference_number"),
  issuedDate: date("issued_date"),
  expiryDate: date("expiry_date"),
  status: dbsStatusEnum("status").notNull().default("pending"),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSafeguardingSchema = createInsertSchema(safeguardingRecordsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSafeguardingRecord = z.infer<typeof insertSafeguardingSchema>;
export type SafeguardingRecord = typeof safeguardingRecordsTable.$inferSelect;
