import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Short-lived record: support typed "PHOTO <REF>", now awaiting the image. */
export const botPhotoPendingTable = pgTable("bot_photo_pending", {
  supportJid: text("support_jid").primaryKey(),
  refNumber: text("ref_number").notNull(),
  expiresAt: timestamp("expires_at").notNull(), // auto-expires after 10 minutes
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type BotPhotoPending = typeof botPhotoPendingTable.$inferSelect;
