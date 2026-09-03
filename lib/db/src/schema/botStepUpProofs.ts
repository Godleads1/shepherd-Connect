import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/** A one-time, action-specific challenge. Only its HMAC digest is persisted. */
export const botStepUpProofsTable = pgTable("bot_step_up_proofs", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  contactVersion: integer("contact_version").notNull(),
  action: text("action").notNull(),
  reference: text("reference").notNull(),
  proofDigest: text("proof_digest").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("bot_step_up_proofs_lookup_idx").on(t.userId, t.reference, t.action, t.expiresAt)]);

export type BotStepUpProof = typeof botStepUpProofsTable.$inferSelect;