import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { childrenTable } from "./children";

export const pickupDelegatesTable = pgTable("pickup_delegates", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull().references(() => childrenTable.id),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  photoUrl: text("photo_url"),
  otpCode: text("otp_code"),
  otpExpiresAt: timestamp("otp_expires_at"),
  parentApproved: boolean("parent_approved").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPickupDelegateSchema = createInsertSchema(pickupDelegatesTable).omit({
  id: true,
  otpCode: true,
  otpExpiresAt: true,
  parentApproved: true,
  createdAt: true,
});

export type InsertPickupDelegate = z.infer<typeof insertPickupDelegateSchema>;
export type PickupDelegate = typeof pickupDelegatesTable.$inferSelect;
