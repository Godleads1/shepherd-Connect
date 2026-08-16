import { pgTable, serial, integer, date, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { familiesTable } from "./families";
import { usersTable } from "./users";

/**
 * A parent's pre-arrival signal: "we're on our way to church with the kids".
 * Lets the check-in desk prepare before the family arrives.
 * Resolved automatically when any child of the family is checked in that day.
 */
export const dropOffIntentsTable = pgTable("drop_off_intents", {
  id: serial("id").primaryKey(),
  familyId: integer("family_id").notNull().references(() => familiesTable.id),
  serviceDate: date("service_date").notNull(),
  status: text("status", { enum: ["on_the_way", "arrived", "cancelled"] }).notNull().default("on_the_way"),
  createdBy: integer("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  // One intent per family per service day
  uniqueIndex("uq_drop_off_intents_family_date").on(t.familyId, t.serviceDate),
]);

export const insertDropOffIntentSchema = createInsertSchema(dropOffIntentsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertDropOffIntent = z.infer<typeof insertDropOffIntentSchema>;
export type DropOffIntent = typeof dropOffIntentsTable.$inferSelect;
