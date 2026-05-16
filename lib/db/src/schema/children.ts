import { pgTable, serial, text, integer, timestamp, pgEnum, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { familiesTable } from "./families";
import { classesTable } from "./classes";

export const genderEnum = pgEnum("gender", ["male", "female"]);
export const servicePreferenceEnum = pgEnum("service_preference", ["7am", "10:30am", "both"]);

export const childrenTable = pgTable("children", {
  id: serial("id").primaryKey(),
  familyId: integer("family_id").notNull().references(() => familiesTable.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dob: date("dob").notNull(),
  gender: genderEnum("gender").notNull(),
  servicePreference: servicePreferenceEnum("service_preference"),
  allergies: text("allergies"),
  medicalNotes: text("medical_notes"),
  photoUrl: text("photo_url"),
  faceDescriptorJson: text("face_descriptor_json"),
  currentClassId: integer("current_class_id").references(() => classesTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertChildSchema = createInsertSchema(childrenTable).omit({
  id: true,
  createdAt: true,
});

export type InsertChild = z.infer<typeof insertChildSchema>;
export type Child = typeof childrenTable.$inferSelect;
