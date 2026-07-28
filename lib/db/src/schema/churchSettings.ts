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
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
