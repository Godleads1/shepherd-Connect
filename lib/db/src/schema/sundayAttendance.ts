import { pgTable, serial, text, timestamp, date, pgEnum, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const scanTypeEnum = pgEnum("scan_type", ["checkpoint", "clock_out", "emergency_out"]);

export const sundayQrCodesTable = pgTable("sunday_qr_codes", {
  id: serial("id").primaryKey(),
  serviceDate: date("service_date", { mode: "string" }).notNull().unique(),
  // The physical column remains `token` for an additive-compatible rollout,
  // but it now contains only a SHA-256 digest of the bearer QR value.
  tokenHash: text("token").notNull().unique(),
  purpose: text("purpose").notNull().default("staff_attendance"),
  revokedAt: timestamp("revoked_at"),
  createdById: integer("created_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const staffScansTable = pgTable("staff_scans", {
  id: serial("id").primaryKey(),
  serviceDate: date("service_date", { mode: "string" }).notNull(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  scannedAt: timestamp("scanned_at").notNull().defaultNow(),
  scanType: scanTypeEnum("scan_type").notNull().default("checkpoint"),
  intervalLabel: text("interval_label"),
  service: text("service"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("uq_staff_scans_user_date_service_type")
    .on(t.userId, t.serviceDate, t.service, t.scanType),
]);
