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
import { attendanceTable } from "./attendance";
import { custodyEpisodesTable } from "./custodyEpisodes";
import { usersTable } from "./users";

export const checkoutOperationsTable = pgTable("checkout_operations", {
  operationId: uuid("operation_id").primaryKey(),
  actorUserId: integer("actor_user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  command: varchar("command", { length: 64 }).notNull(),
  attendanceId: integer("attendance_id")
    .notNull()
    .references(() => attendanceTable.id, { onDelete: "cascade" }),
  custodyEpisodeId: integer("custody_episode_id")
    .references(() => custodyEpisodesTable.id, { onDelete: "set null" }),
  originalOutcome: text("original_outcome").notNull(),
  authoritativeResult: jsonb("authoritative_result").notNull(),
  resolvedPickupRequestIds: integer("resolved_pickup_request_ids").array().notNull().default(sql`'{}'::integer[]`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("checkout_operations_actor_created_idx").on(table.actorUserId, table.createdAt),
  index("checkout_operations_attendance_created_idx").on(table.attendanceId, table.createdAt),
  check(
    "checkout_operations_command_chk",
    sql`${table.command} = 'attendance_checkout'`,
  ),
  check(
    "checkout_operations_outcome_chk",
    sql`${table.originalOutcome} IN ('applied', 'already_applied')`,
  ),
  check(
    "checkout_operations_result_object_chk",
    sql`jsonb_typeof(${table.authoritativeResult}) = 'object'`,
  ),
  check(
    "checkout_operations_result_identity_chk",
    sql`${table.authoritativeResult} ->> 'operationId' = ${table.operationId}::text`,
  ),
  check(
    "checkout_operations_result_binding_chk",
    sql`${table.authoritativeResult} ->> 'outcome' = ${table.originalOutcome}
      AND ${table.authoritativeResult} -> 'resolvedPickupRequestIds' = to_jsonb(${table.resolvedPickupRequestIds})
      AND jsonb_typeof(${table.authoritativeResult} -> 'attendance') = 'object'
      AND jsonb_typeof(${table.authoritativeResult} -> 'alreadyApplied') = 'boolean'`,
  ),
  check(
    "checkout_operations_result_keys_chk",
    sql`${table.authoritativeResult} ?& ARRAY[
        'operationId', 'outcome', 'attendance', 'resolvedPickupRequestIds', 'alreadyApplied'
      ]
      AND (${table.authoritativeResult} - ARRAY[
        'operationId', 'outcome', 'attendance', 'resolvedPickupRequestIds', 'alreadyApplied'
      ]::text[]) = '{}'::jsonb
      AND (${table.authoritativeResult} -> 'attendance') ?& ARRAY[
        'id', 'childId', 'classId', 'serviceDate', 'serviceSlot',
        'checkInTime', 'escortTime', 'checkOutTime',
        'checkedInBy', 'escortedBy', 'checkedOutBy', 'status'
      ]
      AND ((${table.authoritativeResult} -> 'attendance') - ARRAY[
        'id', 'childId', 'classId', 'serviceDate', 'serviceSlot',
        'checkInTime', 'escortTime', 'checkOutTime',
        'checkedInBy', 'escortedBy', 'checkedOutBy', 'status'
      ]::text[]) = '{}'::jsonb`,
  ),
]);

export type CheckoutOperation = typeof checkoutOperationsTable.$inferSelect;
export type InsertCheckoutOperation = typeof checkoutOperationsTable.$inferInsert;