import { index, integer, pgEnum, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const sseTicketPurposeEnum = pgEnum("sse_ticket_purpose", ["sse"]);

/**
 * Only a SHA-256 digest of the browser's one-time ticket is retained. The
 * plaintext ticket exists only in the short-lived, HttpOnly cookie.
 */
export const sseTicketsTable = pgTable("sse_tickets", {
  ticketHash: varchar("ticket_hash", { length: 64 }).primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  // This deliberately is not user_role: selected roles can include approved
  // legacy/secondary roles which are validated against the live account.
  selectedRole: varchar("selected_role", { length: 64 }).notNull(),
  sessionVersion: integer("session_version").notNull().default(1),
  purpose: sseTicketPurposeEnum("purpose").notNull().default("sse"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("sse_tickets_expiry_idx").on(table.expiresAt),
  index("sse_tickets_user_role_idx").on(table.userId, table.selectedRole),
]);

export type SseTicket = typeof sseTicketsTable.$inferSelect;