import { check, date, integer, pgEnum, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { childrenTable } from "./children";
import { familiesTable } from "./families";
import { usersTable } from "./users";

export const custodyEpisodeStatusEnum = pgEnum("custody_episode_status", ["requested", "accepted", "picked_up", "cancelled"]);
export const custodyCheckoutModeEnum = pgEnum("custody_checkout_mode", ["normal", "admin_override"]);

/**
 * The auditable period in which support has accepted physical custody of one child.
 * Attendance describes service presence; this table deliberately describes custody.
 */
export const custodyEpisodesTable = pgTable("custody_episodes", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull().references(() => childrenTable.id),
  familyId: integer("family_id").notNull().references(() => familiesTable.id),
  serviceDate: date("service_date", { mode: "string" }).notNull(),
  requestedServices: text("requested_services", { enum: ["first", "second", "both"] }).notNull(),
  requestedBy: integer("requested_by").notNull().references(() => usersTable.id),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  custodianUserId: integer("custodian_user_id").references(() => usersTable.id),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  status: custodyEpisodeStatusEnum("status").notNull().default("requested"),
  pickedUpAt: timestamp("picked_up_at", { withTimezone: true }),
  pickedUpBy: integer("picked_up_by").references(() => usersTable.id),
  checkoutMode: custodyCheckoutModeEnum("checkout_mode"),
  overrideReason: text("override_reason"),
  overriddenBy: integer("overridden_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("uq_custody_episodes_pending_child").on(t.childId, t.serviceDate).where(sql`status IN ('requested', 'accepted')`),
  check("custody_episode_override_chk", sql`(${t.checkoutMode} = 'admin_override') = (${t.overrideReason} IS NOT NULL AND ${t.overriddenBy} IS NOT NULL)`),
]);

export const custodyEpisodeEventsTable = pgTable("custody_episode_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  eventId: text("event_id").notNull(),
  operation: text("operation").notNull(),
  episodeId: integer("episode_id").references(() => custodyEpisodesTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("uq_custody_episode_events_user_event_operation").on(t.userId, t.eventId, t.operation),
]);

export const insertCustodyEpisodeSchema = createInsertSchema(custodyEpisodesTable).omit({
  id: true, requestedAt: true, acceptedAt: true, pickedUpAt: true, pickedUpBy: true, checkoutMode: true, overrideReason: true,
  overriddenBy: true, createdAt: true,
});
export type InsertCustodyEpisode = z.infer<typeof insertCustodyEpisodeSchema>;
export type CustodyEpisode = typeof custodyEpisodesTable.$inferSelect;