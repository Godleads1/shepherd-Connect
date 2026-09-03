import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { notificationChannelEnum } from "./notifications";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";

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
  // This key identifies a logical delivery, rather than an individual
  // attempt, and is the database-level exactly-once enqueue boundary.
  logicalDedupKey: varchar("logical_dedup_key", { length: 255 }).notNull(),
  notificationType: varchar("notification_type", { length: 100 }).notNull(),
  domainType: varchar("domain_type", { length: 100 }).notNull(),
  domainIdentifier: varchar("domain_identifier", { length: 255 }).notNull(),
  recipientUserId: integer("recipient_user_id").notNull().references(() => usersTable.id),
  channel: notificationChannelEnum("channel").notNull(),
  templateKey: varchar("template_key", { length: 128 }).notNull(),
  templateMetadataJson: varchar("template_metadata_json", { length: 4096 }).notNull().default("{}"),
  payloadJson: varchar("payload_json", { length: 8192 }).notNull(),
  status: notificationOutboxStatusEnum("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  claimToken: uuid("claim_token"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  provider: varchar("provider", { length: 64 }),
  providerMessageId: varchar("provider_message_id", { length: 255 }),
  providerAcceptedAt: timestamp("provider_accepted_at", { withTimezone: true }),
  failureClassification: varchar("failure_classification", { length: 64 }),
  failureDetail: varchar("failure_detail", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  finalizedAt: timestamp("finalized_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("notification_outbox_logical_dedup_key_uidx").on(table.logicalDedupKey),
  index("notification_outbox_claim_idx").on(table.status, table.nextAttemptAt, table.leaseExpiresAt),
  index("notification_outbox_recipient_query_idx").on(table.recipientUserId, table.status, table.createdAt),
  index("notification_outbox_domain_query_idx").on(table.domainType, table.domainIdentifier, table.createdAt),
  check("notification_outbox_external_channel_chk", sql`${table.channel} <> 'in_app'`),
  check("notification_outbox_attempts_nonnegative_chk", sql`${table.attempts} >= 0`),
]);

export type NotificationOutbox = typeof notificationOutboxTable.$inferSelect;
export type InsertNotificationOutbox = typeof notificationOutboxTable.$inferInsert;