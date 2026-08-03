import { pgTable, serial, date, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { serviceSlotEnum } from "./classes";

/**
 * Marks a Sunday where all children attend a general hall session (praise & worship)
 * before going to their individual classes.
 *
 * When active, the "en-route" parent notification changes from
 *   "Sofia is being escorted to Age 1 right now."
 * to
 *   "Sofia is in the general hall for praise & worship — she'll be in Age 1 after the session."
 *
 * serviceSlot = null means both service slots have a hall session.
 */
export const hallSessionsTable = pgTable("hall_sessions", {
  id: serial("id").primaryKey(),
  serviceDate: date("service_date").notNull(),
  serviceSlot: serviceSlotEnum("service_slot"), // null = both slots
  createdBy: integer("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertHallSessionSchema = createInsertSchema(hallSessionsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertHallSession = z.infer<typeof insertHallSessionSchema>;
export type HallSession = typeof hallSessionsTable.$inferSelect;
