import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Distributed lock table for cron scheduler jobs.
 * Each job row is upserted atomically:
 *   INSERT INTO scheduler_locks (job_name, locked_at) VALUES ($1, now())
 *   ON CONFLICT (job_name) DO UPDATE SET locked_at = now()
 *   WHERE scheduler_locks.locked_at < now() - interval '5 minutes'
 *   RETURNING job_name
 * If no row is returned the job was already claimed by another instance.
 */
export const schedulerLocksTable = pgTable("scheduler_locks", {
  jobName: text("job_name").primaryKey(),
  lockedAt: timestamp("locked_at").notNull().defaultNow(),
});

export type SchedulerLock = typeof schedulerLocksTable.$inferSelect;
