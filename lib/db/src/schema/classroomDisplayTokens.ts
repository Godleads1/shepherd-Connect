import { pgTable, serial, integer, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { classesTable } from "./classes";
import { usersTable } from "./users";

export const classroomDisplayTokensTable = pgTable("classroom_display_tokens", {
  id: serial("id").primaryKey(),
  classId: integer("class_id").notNull().references(() => classesTable.id),
  tokenHash: text("token_hash").notNull(),
  issuedBy: integer("issued_by").notNull().references(() => usersTable.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("uq_classroom_display_token_hash").on(t.tokenHash),
  uniqueIndex("uq_classroom_display_active_class")
    .on(t.classId)
    .where(sql`${t.revokedAt} is null`),
  index("idx_classroom_display_class").on(t.classId),
]);

export const insertClassroomDisplayTokenSchema = createInsertSchema(classroomDisplayTokensTable).omit({
  id: true,
  createdAt: true,
});

export type InsertClassroomDisplayToken = z.infer<typeof insertClassroomDisplayTokenSchema>;
export type ClassroomDisplayToken = typeof classroomDisplayTokensTable.$inferSelect;