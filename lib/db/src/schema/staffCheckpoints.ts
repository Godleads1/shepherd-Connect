import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// Admin-configured checkpoint windows per service date
// e.g. { serviceDate: "2026-06-29", serviceSlot: "1st", label: "7:00 AM", opensAt: "06:45", closesAt: "07:15" }
export const staffCheckpointWindowsTable = pgTable("staff_checkpoint_windows", {
  id: serial("id").primaryKey(),
  serviceDate: text("service_date").notNull(),
  serviceSlot: text("service_slot").notNull(), // "1st" | "2nd"
  label: text("label").notNull(),              // "7:00 AM", "8:00 AM", etc
  opensAt: text("opens_at").notNull(),         // "HH:MM" WAT — window opens
  closesAt: text("closes_at").notNull(),       // "HH:MM" WAT — window closes
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Each staff tap/confirmation per checkpoint window
export const staffCheckpointLogsTable = pgTable("staff_checkpoint_logs", {
  id: serial("id").primaryKey(),
  windowId: integer("window_id").notNull().references(() => staffCheckpointWindowsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  checkedInAt: timestamp("checked_in_at").notNull().defaultNow(),
  isOnTime: boolean("is_on_time").notNull().default(true),
});

export type StaffCheckpointWindow = typeof staffCheckpointWindowsTable.$inferSelect;
export type StaffCheckpointLog    = typeof staffCheckpointLogsTable.$inferSelect;
