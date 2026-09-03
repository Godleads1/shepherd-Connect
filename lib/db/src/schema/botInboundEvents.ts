import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Provider message IDs are a durable ingress idempotency boundary. */
export const botInboundEventsTable = pgTable("bot_inbound_events", {
  providerEventId: text("provider_event_id").primaryKey(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  processingStartedAt: timestamp("processing_started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export type BotInboundEvent = typeof botInboundEventsTable.$inferSelect;