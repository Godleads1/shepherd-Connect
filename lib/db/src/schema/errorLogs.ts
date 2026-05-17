import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

export const errorLogsTable = pgTable("error_logs", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  stack: text("stack"),
  path: text("path"),
  method: text("method"),
  statusCode: integer("status_code"),
  userId: integer("user_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ErrorLog = typeof errorLogsTable.$inferSelect;
