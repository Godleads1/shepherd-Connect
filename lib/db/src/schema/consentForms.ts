import { pgTable, serial, integer, text, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { childrenTable } from "./children";
import { usersTable } from "./users";

export const consentTypeEnum = pgEnum("consent_type", [
  "photo",
  "medical_treatment",
  "trips",
  "social_media",
  "emergency_contact",
]);

export const consentFormsTable = pgTable("consent_forms", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull().references(() => childrenTable.id),
  parentId: integer("parent_id").notNull().references(() => usersTable.id),
  type: consentTypeEnum("type").notNull(),
  granted: boolean("granted").notNull().default(false),
  notes: text("notes"),
  grantedAt: timestamp("granted_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertConsentFormSchema = createInsertSchema(consentFormsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  grantedAt: true,
});

export type InsertConsentForm = z.infer<typeof insertConsentFormSchema>;
export type ConsentForm = typeof consentFormsTable.$inferSelect;
