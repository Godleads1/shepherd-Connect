import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Single-row table storing church-wide configuration.
 * Always query by id = 1 (upsert on that row).
 */
export const churchSettingsTable = pgTable("church_settings", {
  id: serial("id").primaryKey(),
  churchName: text("church_name").notNull().default("RCCG City of David"),
  address: text("address").notNull().default("Victoria Island, Lagos"),
  mapsUrl: text("maps_url").notNull().default("https://maps.app.goo.gl/uvgtpVETsCeqkzmDA"),
  // General / church-wide settings
  serviceSlot1Label: text("service_slot_1_label").notNull().default("1st Service"),
  serviceSlot1Time:  text("service_slot_1_time").notNull().default("7:00 – 10:00 AM"),
  serviceSlot2Label: text("service_slot_2_label").notNull().default("2nd Service"),
  serviceSlot2Time:  text("service_slot_2_time").notNull().default("10:30 AM onwards"),
  supportPhone:      text("support_phone").notNull().default(""),
  announcementBanner: text("announcement_banner").notNull().default(""),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
