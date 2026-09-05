import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Persistent OTP sessions for phone/email verification during registration.
 * Replaces the in-memory Map so OTPs survive server restarts and work across
 * multiple API instances. Expired rows are pruned by a periodic cleanup query.
 */
export const otpSessionsTable = pgTable("otp_sessions", {
  pinId: text("pin_id").primaryKey(),
  otp: text("otp").notNull(),
  contact: text("contact").notNull(),
  purpose: text("purpose").notNull().default("registration"),
  channel: text("channel"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  attemptCount: integer("attempt_count").notNull().default(0),
  verifiedAt: timestamp("verified_at"),
}, table => [
  index("otp_sessions_contact_created_at_idx").on(table.contact, table.createdAt),
]);

export type OtpSession = typeof otpSessionsTable.$inferSelect;
