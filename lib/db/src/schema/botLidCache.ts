import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const botLidCacheTable = pgTable("bot_lid_cache", {
  jid: text("jid").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  contactVersion: integer("contact_version").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type BotLidCache = typeof botLidCacheTable.$inferSelect;
