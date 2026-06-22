import { pgTable, serial, integer, text, timestamp, pgEnum, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { childrenTable } from "./children";

export const incidentTypeEnum = pgEnum("incident_type", [
  "behavioural",
  "injury",
  "bullying",
  "medical",
  "safeguarding",
  "other",
]);

export const incidentStatusEnum = pgEnum("incident_status", [
  "open",
  "under_review",
  "risk_assessed",
  "parent_notified",
  "follow_up",
  "escalated",
  "closed",
]);

export const teacherIncidentsTable = pgTable("teacher_incidents", {
  id: serial("id").primaryKey(),
  referenceNumber: text("reference_number").notNull().unique(),
  teacherUserId: integer("teacher_user_id").notNull().references(() => usersTable.id),
  childId: integer("child_id").references(() => childrenTable.id),
  childName: text("child_name"),
  incidentType: incidentTypeEnum("incident_type").notNull(),
  description: text("description").notNull(),
  location: text("location"),
  actionsTaken: text("actions_taken"),
  parentCommunication: text("parent_communication"),
  isHighRisk: boolean("is_high_risk").notNull().default(false),
  status: incidentStatusEnum("status").notNull().default("open"),
  adminNotes: text("admin_notes"),
  resolvedAt: timestamp("resolved_at"),
  incidentDate: timestamp("incident_date").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type TeacherIncident = typeof teacherIncidentsTable.$inferSelect;
