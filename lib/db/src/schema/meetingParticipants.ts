import { boolean, integer, pgTable, primaryKey, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";
import { meetingsTable } from "./meetings";

export const meetingParticipantsTable = pgTable("meeting_participants", {
  meetingId: integer("meeting_id").notNull().references(() => meetingsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  active: boolean("active").notNull().default(true),
  signedInAt: timestamp("signed_in_at", { withTimezone: true }),
}, t => [primaryKey({ columns: [t.meetingId, t.userId] })]);

export const insertMeetingParticipantSchema = createInsertSchema(meetingParticipantsTable);
export type MeetingParticipant = typeof meetingParticipantsTable.$inferSelect;
export type InsertMeetingParticipant = typeof meetingParticipantsTable.$inferInsert;
