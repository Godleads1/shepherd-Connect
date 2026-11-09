import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";

/**
 * Baileys (WhatsApp Web) login state. Previously stored as files on the
 * server's disk, which Replit Autoscale does not keep across restarts or share
 * between instances, so the bot kept losing its login. One row per Baileys
 * key ("creds", "pre-key-1", "session-…"), value serialised with BufferJSON.
 */
export const whatsappAuthStateTable = pgTable("whatsapp_auth_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Single-row lease that decides which API instance owns the WhatsApp
 * connection. Two instances using one WhatsApp login knock each other off
 * ("connection replaced") until WhatsApp logs the session out.
 */
export const whatsappLeaderLeaseTable = pgTable("whatsapp_leader_lease", {
  id: integer("id").primaryKey(),
  holder: text("holder").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
