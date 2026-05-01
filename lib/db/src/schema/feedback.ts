import { pgTable, serial, integer, text, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const parentFeedbackTable = pgTable("parent_feedback", {
  id: serial("id").primaryKey(),
  parentId: integer("parent_id").notNull().references(() => usersTable.id),
  serviceDate: date("service_date").notNull(),
  rating: numeric("rating", { precision: 3, scale: 1 }).notNull(),
  classExperience: numeric("class_experience", { precision: 3, scale: 1 }).notNull(),
  teacherEngagement: numeric("teacher_engagement", { precision: 3, scale: 1 }).notNull(),
  safetyRating: numeric("safety_rating", { precision: 3, scale: 1 }).notNull(),
  improvementNote: text("improvement_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFeedbackSchema = createInsertSchema(parentFeedbackTable).omit({
  id: true,
  parentId: true,
  createdAt: true,
});

export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof parentFeedbackTable.$inferSelect;
