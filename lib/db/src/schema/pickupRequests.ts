import { date, integer, pgEnum, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { childrenTable } from "./children";
import { classesTable } from "./classes";
import { usersTable } from "./users";

export const pickupRequestStatusEnum = pgEnum("pickup_request_status", ["requested", "resolved", "cancelled"]);

/**
 * A parent pickup signal. This is intentionally durable: classroom SSE clients
 * are a delivery mechanism, not the record of whether a signal is active.
 */
export const pickupRequestsTable = pgTable("pickup_requests", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull().references(() => childrenTable.id),
  classId: integer("class_id").notNull().references(() => classesTable.id),
  serviceDate: date("service_date", { mode: "string" }).notNull(),
  requestedBy: integer("requested_by").notNull().references(() => usersTable.id),
  childName: text("child_name").notNull(),
  parentName: text("parent_name").notNull(),
  className: text("class_name").notNull(),
  homeClassName: text("home_class_name"),
  status: pickupRequestStatusEnum("status").notNull().default("requested"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedBy: integer("resolved_by").references(() => usersTable.id),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancelledBy: integer("cancelled_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // This database invariant makes retries safe across processes and restarts.
  uniqueIndex("uq_pickup_requests_active_child_date")
    .on(t.childId, t.serviceDate)
    .where(sql`${t.status} = 'requested'`),
]);

export const insertPickupRequestSchema = createInsertSchema(pickupRequestsTable).omit({
  id: true,
  requestedAt: true,
  resolvedAt: true,
  resolvedBy: true,
  cancelledAt: true,
  cancelledBy: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPickupRequest = z.infer<typeof insertPickupRequestSchema>;
export type PickupRequest = typeof pickupRequestsTable.$inferSelect;