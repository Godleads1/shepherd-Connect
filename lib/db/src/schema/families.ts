import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const familiesTable = pgTable("families", {
  id: serial("id").primaryKey(),
  familyCode: text("family_code").notNull().unique(),
  parent1Id: integer("parent_1_id").references(() => usersTable.id),
  parent2Id: integer("parent_2_id").references(() => usersTable.id),
  address: text("address"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFamilySchema = createInsertSchema(familiesTable).omit({
  id: true,
  familyCode: true,
  createdAt: true,
});

export type InsertFamily = z.infer<typeof insertFamilySchema>;
export type Family = typeof familiesTable.$inferSelect;
