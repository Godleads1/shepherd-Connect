import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Provider message IDs are a durable ingress idempotency boundary. */
export const botInboundEventsTable = pgTable("bot_inbound_events", {
  providerEventId: text("provider_event_id").primaryKey(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BotInboundEvent = typeof botInboundEventsTable.$inferSelect;