import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEmergencyUpdateSchema = createInsertSchema(emergencyUpdatesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertEmergencyUpdate = z.infer<typeof insertEmergencyUpdateSchema>;
export type EmergencyUpdate = typeof emergencyUpdatesTable.$inferSelect;
