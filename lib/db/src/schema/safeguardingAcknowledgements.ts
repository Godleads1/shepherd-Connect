import { pgTable, serial, integer, timestamp, text } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const safeguardingAcknowledgementsTable = pgTable("safeguarding_acknowledgements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  policyVersion: text("policy_version").notNull().default("v1.0"),
  acknowledgedAt: timestamp("acknowledged_at").notNull().defaultNow(),
});

export type SafeguardingAcknowledgement = typeof safeguardingAcknowledgementsTable.$inferSelect;
