import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { childrenTable } from "./children";
import { usersTable } from "./users";

export const emergencyTypeEnum = pgEnum("emergency_type", [
  "medical",
  "missing_child",
  "fire_evacuation",
  "security",
  "general",
]);

export const emergencyLevelEnum = pgEnum("emergency_level", ["L1", "L2", "L3", "L4"]);

export const emergencyStatusEnum = pgEnum("emergency_status", [
  "active",
  "monitoring",
  "resolved",
]);

export const emergenciesTable = pgTable("emergencies", {
  id: serial("id").primaryKey(),
  type: emergencyTypeEnum("type").notNull(),
  level: emergencyLevelEnum("level").notNull(),
  childId: integer("child_id").references(() => childrenTable.id),
  triggeredBy: integer("triggered_by").notNull().references(() => usersTable.id),
  status: emergencyStatusEnum("status").notNull().default("active"),
  description: text("description").notNull(),
  resolutionNotes: text("resolution_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const insertEmergencySchema = createInsertSchema(emergenciesTable).omit({
  id: true,
  triggeredBy: true,
  status: true,
  resolutionNotes: true,
  createdAt: true,
  resolvedAt: true,
});

export type InsertEmergency = z.infer<typeof insertEmergencySchema>;
export type Emergency = typeof emergenciesTable.$inferSelect;
