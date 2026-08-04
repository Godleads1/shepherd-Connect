import { pgTable, serial, text, integer, timestamp, uuid, pgEnum } from "drizzle-orm/pg-core";

export const whatsappBroadcastStatusEnum = pgEnum("whatsapp_broadcast_status", [
  "running",
  "completed",
]);

export const whatsappQueueItemStatusEnum = pgEnum("whatsapp_queue_item_status", [
  "pending",
  "delivered",
  "failed",
  "skipped",
]);

/**
 * One row per broadcast event (admin sends a broadcast or pre-dismissal alert).
 * Used to show admins delivery results and to group queue items for restart recovery.
 */
export const whatsappBroadcastsTable = pgTable("whatsapp_broadcasts", {
  id: uuid("id").primaryKey().defaultRandom(),
  context: text("context").notNull(),          // "broadcast" | "pre-dismissal"
  title: text("title").notNull(),
  message: text("message").notNull(),
  totalCount: integer("total_count").notNull().default(0),
  deliveredCount: integer("delivered_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  skippedCount: integer("skipped_count").notNull().default(0),
  status: whatsappBroadcastStatusEnum("status").notNull().default("running"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

/**
 * One row per recipient in a broadcast. Persisted before sending so a server
 * restart mid-broadcast can re-enqueue any rows still marked "pending".
 */
export const whatsappQueueItemsTable = pgTable("whatsapp_queue_items", {
  id: serial("id").primaryKey(),
  broadcastId: uuid("broadcast_id").notNull().references(() => whatsappBroadcastsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull(),
  status: whatsappQueueItemStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
});

export type WhatsappBroadcast = typeof whatsappBroadcastsTable.$inferSelect;
export type WhatsappQueueItem = typeof whatsappQueueItemsTable.$inferSelect;
