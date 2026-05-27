import { pgTable, serial, text, boolean, timestamp, pgEnum, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userRoleEnum = pgEnum("user_role", [
  "super_admin",
  "admin",
  "teacher",
  "attendant",
  "parent",
]);

export const userStatusEnum = pgEnum("user_status", [
  "active",
  "pending_approval",
  "suspended",
]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  passwordHash: text("password_hash"),
  googleId: text("google_id").unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  emailVerificationToken: text("email_verification_token"),
  role: userRoleEnum("role").notNull().default("parent"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  faceDescriptorJson: text("face_descriptor_json"),
  isActive: boolean("is_active").notNull().default(true),
  status: userStatusEnum("status").notNull().default("active"),
  photoUrl: text("photo_url"),
  dob: date("dob"),
  gender: text("gender"),
  placeOfWork: text("place_of_work"),
  communicationPrefs: text("communication_prefs"),
  hideContactFromAdmin: boolean("hide_contact_from_admin").notNull().default(false),
  mfaSecret: text("mfa_secret"),
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  secondaryRoles: text("secondary_roles"),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  passwordHash: true,
}).extend({
  password: z.string().min(6),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
