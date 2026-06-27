import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const botSessionsTable = pgTable("bot_sessions", {
  jid: text("jid").primaryKey(),
  step: text("step").notNull().default("idle"),
  activeUserId: integer("active_user_id").references(() => usersTable.id),
  dataJson: text("data_json").notNull().default("{}"),
  expiresAt: timestamp("expires_at").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type BotSession = typeof botSessionsTable.$inferSelect;
