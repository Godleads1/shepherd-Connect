import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Persistent OTP sessions for phone/email verification during registration.
 * Replaces the in-memory Map so OTPs survive server restarts and work across
 * multiple API instances. Expired rows are pruned by a periodic cleanup query.
 */
export const otpSessionsTable = pgTable("otp_sessions", {
  pinId: text("pin_id").primaryKey(),
  otp: text("otp").notNull(),
  contact: text("contact").notNull(), // phone or email address
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type OtpSession = typeof otpSessionsTable.$inferSelect;
