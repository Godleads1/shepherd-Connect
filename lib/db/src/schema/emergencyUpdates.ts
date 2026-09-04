import { pgTable, serial, integer, text, timestamp, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { emergenciesTable } from "./emergencies";
import { usersTable } from "./users";

export const emergencyUpdateTypeEnum = pgEnum("emergency_update_type", [
  "update",
  "escalation",
  "all_clear",
  "note",
]);

export const emergencyUpdatesTable = pgTable("emergency_updates", {
  id: serial("id").primaryKey(),
  emergencyId: integer("emergency_id").notNull().references(() => emergenciesTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  message: text("message").notNull(),
  updateType: emergencyUpdateTypeEnum("update_type").notNull().default("update"),
  // Family-visible copy is deliberately separate from the internal incident
  // message. Parent APIs select only these reviewed fields.
  familyStatus: text("family_status"),
  familyInstructions: text("family_instructions"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  publishedBy: integer("published_by").references(() => usersTable.id),
  // Client event IDs are the durable retry boundary for family publication.
  // They are intentionally not included in the parent-facing DTO.
  eventId: text("event_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_emergency_updates_family_event")
    .on(table.emergencyId, table.eventId)
    .where(sql`${table.eventId} IS NOT NULL`),
]);

export const insertEmergencyUpdateSchema = createInsertSchema(emergencyUpdatesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertEmergencyUpdate = z.infer<typeof insertEmergencyUpdateSchema>;
export type EmergencyUpdate = typeof emergencyUpdatesTable.$inferSelect;
