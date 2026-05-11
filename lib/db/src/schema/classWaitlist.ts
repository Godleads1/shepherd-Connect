import { pgTable, serial, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { childrenTable } from "./children";
import { classesTable } from "./classes";
import { familiesTable } from "./families";

export const waitlistStatusEnum = pgEnum("waitlist_status", [
  "waiting",
  "notified",
  "enrolled",
  "cancelled",
]);

export const classWaitlistTable = pgTable("class_waitlist", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull().references(() => childrenTable.id),
  classId: integer("class_id").notNull().references(() => classesTable.id),
  familyId: integer("family_id").notNull().references(() => familiesTable.id),
  status: waitlistStatusEnum("status").notNull().default("waiting"),
  requestedAt: timestamp("requested_at").notNull().defaultNow(),
  notifiedAt: timestamp("notified_at"),
});

export const insertClassWaitlistSchema = createInsertSchema(classWaitlistTable).omit({
  id: true,
  requestedAt: true,
  notifiedAt: true,
});

export type InsertClassWaitlist = z.infer<typeof insertClassWaitlistSchema>;
export type ClassWaitlist = typeof classWaitlistTable.$inferSelect;
