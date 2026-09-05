import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const commandOperationsTable = pgTable("command_operations", {
  operationId: uuid("operation_id").primaryKey(),
  actorUserId: integer("actor_user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  command: varchar("command", { length: 64 }).notNull(),
  targetType: varchar("target_type", { length: 64 }).notNull(),
  targetId: text("target_id").notNull(),
  payloadFingerprint: varchar("payload_fingerprint", { length: 64 }).notNull(),
  resultVersion: integer("result_version").notNull(),
  resultJson: jsonb("result_json").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("command_operations_actor_created_idx").on(table.actorUserId, table.createdAt),
  index("command_operations_target_idx").on(table.targetType, table.targetId),
  check("command_operations_result_version_chk", sql`${table.resultVersion} > 0`),
  check("command_operations_result_object_chk", sql`jsonb_typeof(${table.resultJson}) = 'object'`),
  check(
    "command_operations_minimal_result_chk",
    sql`${table.resultJson} ? 'primaryId'
      AND jsonb_typeof(${table.resultJson} -> 'primaryId') = 'number'
      AND (
        (${table.resultJson} - 'primaryId') = '{}'::jsonb
        OR (
          ${table.command} = 'pickup_delegate_create'
          AND (${table.resultJson} - 'primaryId' - 'createdIds' - 'childIds') = '{}'::jsonb
          AND jsonb_typeof(${table.resultJson} -> 'createdIds') = 'array'
          AND jsonb_typeof(${table.resultJson} -> 'childIds') = 'array'
        )
      )`,
  ),
]);

export type CommandOperation = typeof commandOperationsTable.$inferSelect;
export type InsertCommandOperation = typeof commandOperationsTable.$inferInsert;