import { pgTable, serial, integer, text, date, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { childrenTable } from "./children";
import { teachersTable } from "./teachers";

export const appraisalLevelEnum = pgEnum("appraisal_level", [
  "excellent",
  "good",
  "fair",
  "needs_encouragement",
]);

export const childAppraisalsTable = pgTable("child_appraisals", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull().references(() => childrenTable.id),
  teacherId: integer("teacher_id").notNull().references(() => teachersTable.id),
  serviceDate: date("service_date").notNull(),
  participationLevel: appraisalLevelEnum("participation_level").notNull(),
  scriptureEngagement: appraisalLevelEnum("scripture_engagement").notNull(),
  socialInteraction: appraisalLevelEnum("social_interaction").notNull(),
  milestoneNote: text("milestone_note"),
  personalNoteToParent: text("personal_note_to_parent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAppraisalSchema = createInsertSchema(childAppraisalsTable).omit({
  id: true,
  teacherId: true,
  createdAt: true,
});

export type InsertAppraisal = z.infer<typeof insertAppraisalSchema>;
export type Appraisal = typeof childAppraisalsTable.$inferSelect;
