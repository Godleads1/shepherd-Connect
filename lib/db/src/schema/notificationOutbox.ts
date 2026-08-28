import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { notificationChannelEnum } from "./notifications";

export const notificationOutboxStatusEnum = pgEnum("notification_outbox_status", [
  "pending",
  "processing",
  "retryable",
  "accepted",
  "uncertain",
  "skipped",
  "dead_letter",
]);

export const notificationOutboxTable = pgTable("notification_outbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  logicalDedupKey: text("logical_dedup_key").notNull(),
  channel: notificationChannelEnum("channel").notNull(),
  recipient: text("recipient").notNull(),
  payloadJson: text("payload_json").notNull(),
  status: notificationOutboxStatusEnum("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
  claimToken: uuid("claim_token"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  failureDetail: text("failure_detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  finalizedAt: timestamp("finalized_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("notification_outbox_logical_dedup_key_uidx").on(table.logicalDedupKey),
  index("notification_outbox_claim_idx").on(table.status, table.availableAt, table.leaseExpiresAt),
]);

export type NotificationOutbox = typeof notificationOutboxTable.$inferSelect;
export type InsertNotificationOutbox = typeof notificationOutboxTable.$inferInsert;