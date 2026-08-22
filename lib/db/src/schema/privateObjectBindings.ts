import { pgTable, serial, integer, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const privateObjectBindingsTable = pgTable("private_object_bindings", {
  id: serial("id").primaryKey(),
  objectPath: text("object_path").notNull(),
  uploaderId: integer("uploader_id").notNull().references(() => usersTable.id),
  resourceType: text("resource_type"),
  resourceId: integer("resource_id"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  boundAt: timestamp("bound_at", { withTimezone: true }),
}, (t) => [
  uniqueIndex("uq_private_object_path").on(t.objectPath),
  index("idx_private_object_resource").on(t.resourceType, t.resourceId),
]);

export const insertPrivateObjectBindingSchema = createInsertSchema(privateObjectBindingsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertPrivateObjectBinding = z.infer<typeof insertPrivateObjectBindingSchema>;
export type PrivateObjectBinding = typeof privateObjectBindingsTable.$inferSelect;