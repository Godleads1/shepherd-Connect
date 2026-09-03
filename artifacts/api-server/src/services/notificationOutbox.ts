import { randomUUID } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";

export const OUTBOX_MAX_ATTEMPTS = 5;
export const OUTBOX_BACKOFF_MS = [30_000, 2 * 60_000, 10 * 60_000, 30 * 60_000, 2 * 60 * 60_000] as const;
export const OUTBOX_FAILURE_DETAIL_MAX_LENGTH = 500;
export const OUTBOX_TEMPLATE_METADATA_MAX_LENGTH = 4096;
export const OUTBOX_PAYLOAD_MAX_LENGTH = 8192;

type QueryResult = { rows: unknown[] };
export type OutboxExecutor = { execute(query: SQL): PromiseLike<QueryResult> };
export type OutboxChannel = "whatsapp" | "sms" | "email";
export type ExternalNotificationChannel = OutboxChannel;
export type FinalOutcome = "accepted" | "uncertain" | "skipped" | "retryable";

export interface EnqueueNotification {
  logicalDedupKey: string;
  notificationType: string;
  domainType: string;
  domainIdentifier: string;
  recipientUserId: number;
  channel: OutboxChannel;
  templateKey: string;
  templateMetadata?: unknown;
  payload: unknown;
}

export interface NotificationProjection {
  userId: number;
  type: string;
  title: string;
  message: string;
  metadata?: unknown;
}

/**
 * The one supported way to create a user-visible notification with external
 * work.  The advisory lock makes the projection idempotent too (the outbox
 * unique key alone only protects delivery rows).
 *
 * `logicalIdentity` is a caller-owned domain identity. It must not contain a
 * timestamp or random value: it is also the recovery/idempotency boundary.
 */
export async function createNotificationDelivery(
  tx: OutboxExecutor,
  input: {
    logicalIdentity: string;
    domainType: string;
    domainIdentifier: string;
    projection: NotificationProjection;
    channels: OutboxChannel[];
    templateKey?: string;
    templateMetadata?: unknown;
  },
): Promise<{ notificationId: number; outbox: { id: string; inserted: boolean }[]; inserted: boolean }> {
  const identity = bounded(input.logicalIdentity, 220, "logicalIdentity");
  const channels = [...new Set(input.channels)];
  for (const channel of channels) {
    if (!["whatsapp", "sms", "email"].includes(channel)) throw new Error("channel must be an external delivery channel");
  }
  // Serialize same logical operation while retaining concurrency for all others.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${identity}))`);
  const existing = await tx.execute(sql`
    SELECT payload_json AS "payloadJson" FROM notification_outbox
    WHERE logical_dedup_key = ${`${identity}:whatsapp`}
       OR logical_dedup_key = ${`${identity}:sms`}
       OR logical_dedup_key = ${`${identity}:email`}
    LIMIT 1
  `);
  let notificationId: number | undefined;
  const existingPayload = rows<{ payloadJson: string }>(existing)[0]?.payloadJson;
  if (existingPayload) {
    try { notificationId = Number((JSON.parse(existingPayload) as { notificationId?: number }).notificationId); } catch { /* invalid legacy payload creates a new projection */ }
  }
  let inserted = false;
  if (!Number.isSafeInteger(notificationId) || notificationId! < 1) {
    const projection = input.projection;
    if (!Number.isSafeInteger(projection.userId) || projection.userId < 1) throw new Error("projection.userId must be a positive integer");
    const result = await tx.execute(sql`
      INSERT INTO notifications (user_id, type, title, message, channel, read_status, metadata_json)
      VALUES (${projection.userId}, ${projection.type}, ${projection.title}, ${projection.message}, 'in_app', false,
        ${projection.metadata === undefined ? null : boundedJson(projection.metadata, OUTBOX_PAYLOAD_MAX_LENGTH, "metadata")})
      RETURNING id
    `);
    notificationId = Number(rows<{ id: number }>(result)[0]?.id);
    if (!Number.isSafeInteger(notificationId) || notificationId < 1) throw new Error("notification projection insert did not return an id");
    inserted = true;
  }
  const outbox: { id: string; inserted: boolean }[] = [];
  for (const channel of channels) {
    outbox.push(await enqueueNotification(tx, {
      logicalDedupKey: `${identity}:${channel}`,
      notificationType: input.projection.type,
      domainType: input.domainType,
      domainIdentifier: input.domainIdentifier,
      recipientUserId: input.projection.userId,
      channel,
      templateKey: input.templateKey ?? input.projection.type,
      templateMetadata: input.templateMetadata,
      // Content stays authoritative in notifications; this is deliberately only a pointer.
      payload: { notificationId },
    }));
  }
  return { notificationId: notificationId!, outbox, inserted };
}

export interface ClaimedNotification {
  id: string; logicalDedupKey: string; notificationType: string; domainType: string;
  domainIdentifier: string; recipientUserId: number; channel: OutboxChannel; templateKey: string;
  templateMetadataJson: string; payloadJson: string; attempts: number; claimToken: string; leaseExpiresAt: Date;
}

function rows<T>(result: QueryResult): T[] {
  return result.rows as T[];
}

function bounded(value: string, limit: number, field: string): string {
  if (!value || value.length > limit) throw new Error(`${field} must be 1-${limit} characters`);
  return value;
}

function boundedJson(value: unknown, limit: number, field: string): string {
  const serialized = JSON.stringify(value ?? {});
  if (serialized === undefined || serialized.length > limit) {
    throw new Error(`${field} must be valid JSON no longer than ${limit} characters`);
  }
  return serialized;
}

/**
 * Enqueue through the caller's domain transaction. The unique logical key
 * makes a repeated logical operation return its original delivery row.
 */
export async function enqueueNotification(tx: OutboxExecutor, input: EnqueueNotification): Promise<{ id: string; inserted: boolean }> {
  if (!["whatsapp", "sms", "email"].includes(input.channel)) throw new Error("channel must be an external delivery channel");
  if (!Number.isSafeInteger(input.recipientUserId) || input.recipientUserId < 1) throw new Error("recipientUserId must be a positive integer");
  const result = await tx.execute(sql`
    INSERT INTO notification_outbox
      (logical_dedup_key, notification_type, domain_type, domain_identifier,
       recipient_user_id, channel, template_key, template_metadata_json, payload_json)
    VALUES (${bounded(input.logicalDedupKey, 255, "logicalDedupKey")},
      ${bounded(input.notificationType, 100, "notificationType")}, ${bounded(input.domainType, 100, "domainType")},
      ${bounded(input.domainIdentifier, 255, "domainIdentifier")}, ${input.recipientUserId}, ${input.channel},
      ${bounded(input.templateKey, 128, "templateKey")},
      ${boundedJson(input.templateMetadata, OUTBOX_TEMPLATE_METADATA_MAX_LENGTH, "templateMetadata")},
      ${boundedJson(input.payload, OUTBOX_PAYLOAD_MAX_LENGTH, "payload")})
    ON CONFLICT (logical_dedup_key) DO UPDATE SET logical_dedup_key = EXCLUDED.logical_dedup_key
    RETURNING id, (xmax = 0) AS inserted
  `);
  return rows<{ id: string; inserted: boolean }>(result)[0];
}

/** Claims ready rows atomically; uncertain rows are terminal and never selected. */
export async function claimNotifications(executor: OutboxExecutor, options: {
  limit?: number;
  leaseMs?: number;
  /** Optional operational/test partition; production workers intentionally omit it. */
  logicalDedupKeyPrefix?: string;
} = {}): Promise<ClaimedNotification[]> {
  const limit = Math.max(1, Math.min(100, Math.floor(options.limit ?? 20)));
  const leaseMs = Math.max(5_000, Math.min(5 * 60_000, Math.floor(options.leaseMs ?? 30_000)));
  const logicalDedupKeyPrefix = options.logicalDedupKeyPrefix ?? null;
  const claimToken = randomUUID();
  const result = await executor.execute(sql`
    WITH exhausted AS (
      UPDATE notification_outbox SET status = 'dead_letter', claim_token = NULL, lease_expires_at = NULL,
        failure_classification = COALESCE(failure_classification, 'lease_expired'), finalized_at = now(), updated_at = now()
      WHERE status = 'processing' AND lease_expires_at <= now() AND attempts >= ${OUTBOX_MAX_ATTEMPTS}
    ), candidates AS (
      SELECT id FROM notification_outbox WHERE attempts < ${OUTBOX_MAX_ATTEMPTS}
      AND (${logicalDedupKeyPrefix}::text IS NULL OR logical_dedup_key LIKE ${logicalDedupKeyPrefix})
      AND (
        (status IN ('pending', 'retryable') AND next_attempt_at <= now()) OR
        (status = 'processing' AND lease_expires_at <= now())
      ) ORDER BY next_attempt_at, created_at FOR UPDATE SKIP LOCKED LIMIT ${limit}
    )
    UPDATE notification_outbox AS outbox SET status = 'processing', attempts = outbox.attempts + 1,
      claim_token = ${claimToken}::uuid, lease_expires_at = now() + (${leaseMs} * interval '1 millisecond'),
      failure_classification = NULL, failure_detail = NULL, updated_at = now()
    FROM candidates WHERE outbox.id = candidates.id
    RETURNING outbox.id, outbox.logical_dedup_key AS "logicalDedupKey",
      outbox.notification_type AS "notificationType", outbox.domain_type AS "domainType",
      outbox.domain_identifier AS "domainIdentifier", outbox.recipient_user_id AS "recipientUserId",
      outbox.channel, outbox.template_key AS "templateKey", outbox.template_metadata_json AS "templateMetadataJson",
      outbox.payload_json AS "payloadJson", outbox.attempts, outbox.claim_token AS "claimToken",
      outbox.lease_expires_at AS "leaseExpiresAt"
  `);
  return rows<ClaimedNotification>(result);
}

export function redactFailureDetail(detail: unknown): string {
  const raw = detail instanceof Error ? detail.message : String(detail ?? "Unknown delivery failure");
  return raw.replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(/(\b(?:token|secret|password|api[_-]?key)\s*[=:]\s*)\S+/gi, "$1[REDACTED]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[REDACTED_PHONE]").slice(0, OUTBOX_FAILURE_DETAIL_MAX_LENGTH);
}

export function retryDelayMs(attempts: number): number {
  return OUTBOX_BACKOFF_MS[Math.max(0, Math.min(OUTBOX_BACKOFF_MS.length - 1, attempts - 1))];
}

/** Compare-and-set completion prevents a stale lease holder from overwriting a newer owner. */
export async function finalizeNotification(executor: OutboxExecutor, input: {
  id: string; claimToken: string; attempts: number; outcome: FinalOutcome; failureClassification?: string;
  failureDetail?: unknown; provider?: string; providerMessageId?: string; providerAcceptedAt?: Date;
}): Promise<boolean> {
  const exhausted = input.outcome === "retryable" && input.attempts >= OUTBOX_MAX_ATTEMPTS;
  const status = exhausted ? "dead_letter" : input.outcome;
  const delay = input.outcome === "retryable" && !exhausted ? retryDelayMs(input.attempts) : 0;
  const failure = status === "accepted" || status === "skipped" ? null : redactFailureDetail(input.failureDetail);
  const classification = failure && input.failureClassification ? bounded(input.failureClassification, 64, "failureClassification") : null;
  const provider = input.provider ? bounded(input.provider, 64, "provider") : null;
  const providerMessageId = input.providerMessageId ? bounded(input.providerMessageId, 255, "providerMessageId") : null;
  const result = await executor.execute(sql`
    UPDATE notification_outbox SET status = ${status},
      next_attempt_at = CASE WHEN ${status} = 'retryable' THEN now() + (${delay} * interval '1 millisecond') ELSE next_attempt_at END,
      claim_token = NULL, lease_expires_at = NULL, provider = ${provider}, provider_message_id = ${providerMessageId},
      provider_accepted_at = ${input.providerAcceptedAt ?? null}, failure_classification = ${classification}, failure_detail = ${failure},
      finalized_at = CASE WHEN ${status} IN ('accepted', 'uncertain', 'skipped', 'dead_letter') THEN now() ELSE NULL END,
      updated_at = now()
    WHERE id = ${input.id}::uuid AND claim_token = ${input.claimToken}::uuid AND status = 'processing'
    RETURNING id
  `);
  return result.rows.length === 1;
}