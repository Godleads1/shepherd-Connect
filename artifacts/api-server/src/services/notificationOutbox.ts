import { randomUUID } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";

export const OUTBOX_MAX_ATTEMPTS = 5;
export const OUTBOX_BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000] as const;
export const OUTBOX_FAILURE_DETAIL_MAX_LENGTH = 500;

type QueryResult = { rows: unknown[] };
export type OutboxExecutor = {
  execute(query: SQL): PromiseLike<QueryResult>;
};

export type OutboxChannel = "in_app" | "whatsapp" | "sms" | "email";
export type FinalOutcome = "accepted" | "uncertain" | "skipped" | "retryable";

export interface EnqueueNotification {
  logicalDedupKey: string;
  channel: OutboxChannel;
  recipient: string;
  payload: unknown;
}

export interface ClaimedNotification {
  id: string;
  logicalDedupKey: string;
  channel: OutboxChannel;
  recipient: string;
  payloadJson: string;
  attempts: number;
  claimToken: string;
  leaseExpiresAt: Date;
}

function rows<T>(result: QueryResult): T[] {
  return result.rows as T[];
}

/**
 * Enqueue through the caller's transaction. A duplicate logical operation
 * returns the existing row and does not create another delivery.
 */
export async function enqueueNotification(
  tx: OutboxExecutor,
  input: EnqueueNotification,
): Promise<{ id: string; inserted: boolean }> {
  const result = await tx.execute(sql`
    INSERT INTO notification_outbox
      (logical_dedup_key, channel, recipient, payload_json)
    VALUES
      (${input.logicalDedupKey}, ${input.channel}, ${input.recipient}, ${JSON.stringify(input.payload)})
    ON CONFLICT (logical_dedup_key) DO UPDATE
      SET logical_dedup_key = EXCLUDED.logical_dedup_key
    RETURNING id, (xmax = 0) AS inserted
  `);
  return rows<{ id: string; inserted: boolean }>(result)[0];
}

/**
 * Claims each row once across PostgreSQL workers. Expired leases can be
 * reclaimed, but terminal/uncertain rows are never selected.
 */
export async function claimNotifications(
  executor: OutboxExecutor,
  options: { limit?: number; leaseMs?: number } = {},
): Promise<ClaimedNotification[]> {
  const limit = Math.max(1, Math.min(100, Math.floor(options.limit ?? 20)));
  const leaseMs = Math.max(5_000, Math.min(5 * 60_000, Math.floor(options.leaseMs ?? 30_000)));
  const claimToken = randomUUID();
  const result = await executor.execute(sql`
    WITH exhausted AS (
      UPDATE notification_outbox
      SET status = 'dead_letter', claim_token = NULL, lease_expires_at = NULL,
          finalized_at = now(), updated_at = now()
      WHERE status = 'processing' AND lease_expires_at <= now()
        AND attempts >= ${OUTBOX_MAX_ATTEMPTS}
    ), candidates AS (
      SELECT id
      FROM notification_outbox
      WHERE attempts < ${OUTBOX_MAX_ATTEMPTS}
        AND (
          (status IN ('pending', 'retryable') AND available_at <= now())
          OR (status = 'processing' AND lease_expires_at <= now())
        )
      ORDER BY available_at, created_at
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    UPDATE notification_outbox AS outbox
    SET status = 'processing',
        attempts = outbox.attempts + 1,
        claim_token = ${claimToken}::uuid,
        lease_expires_at = now() + (${leaseMs} * interval '1 millisecond'),
        failure_detail = NULL,
        updated_at = now()
    FROM candidates
    WHERE outbox.id = candidates.id
    RETURNING outbox.id,
      outbox.logical_dedup_key AS "logicalDedupKey",
      outbox.channel,
      outbox.recipient,
      outbox.payload_json AS "payloadJson",
      outbox.attempts,
      outbox.claim_token AS "claimToken",
      outbox.lease_expires_at AS "leaseExpiresAt"
  `);
  return rows<ClaimedNotification>(result);
}

export function redactFailureDetail(detail: unknown): string {
  const raw = detail instanceof Error ? detail.message : String(detail ?? "Unknown delivery failure");
  return raw
    .replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(/(\b(?:token|secret|password|api[_-]?key)\s*[=:]\s*)\S+/gi, "$1[REDACTED]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[REDACTED_PHONE]")
    .slice(0, OUTBOX_FAILURE_DETAIL_MAX_LENGTH);
}

export function retryDelayMs(attempts: number): number {
  const index = Math.max(0, Math.min(OUTBOX_BACKOFF_MS.length - 1, attempts - 1));
  return OUTBOX_BACKOFF_MS[index];
}

/**
 * Finalization is a compare-and-set on both id and unpredictable claim token.
 * A zero-row result means the lease was reclaimed and the caller is stale.
 */
export async function finalizeNotification(
  executor: OutboxExecutor,
  input: { id: string; claimToken: string; attempts: number; outcome: FinalOutcome; failureDetail?: unknown },
): Promise<boolean> {
  const retryExhausted = input.outcome === "retryable" && input.attempts >= OUTBOX_MAX_ATTEMPTS;
  const status = retryExhausted ? "dead_letter" : input.outcome;
  const retryDelay = input.outcome === "retryable" && !retryExhausted
    ? retryDelayMs(input.attempts)
    : 0;
  const failure = input.outcome === "accepted" || input.outcome === "skipped"
    ? null
    : redactFailureDetail(input.failureDetail);
  const result = await executor.execute(sql`
    UPDATE notification_outbox
    SET status = ${status},
        available_at = CASE
          WHEN ${status} = 'retryable'
            THEN now() + (${retryDelay} * interval '1 millisecond')
          ELSE available_at
        END,
        claim_token = NULL,
        lease_expires_at = NULL,
        failure_detail = ${failure},
        finalized_at = CASE WHEN ${status} IN ('accepted', 'uncertain', 'skipped', 'dead_letter')
          THEN now() ELSE NULL END,
        updated_at = now()
    WHERE id = ${input.id}::uuid
      AND claim_token = ${input.claimToken}::uuid
      AND status = 'processing'
    RETURNING id
  `);
  return result.rows.length === 1;
}