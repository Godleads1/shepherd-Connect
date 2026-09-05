import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { commandOperationsTable } from "@workspace/db";

export type OperationBinding = {
  actorUserId: number;
  command: string;
  targetType: string;
  targetId: string;
  payloadFingerprint: string;
};

export async function lockCommandOperation(tx: any, operationId: string): Promise<void> {
  await tx.execute(sql`
    SELECT pg_advisory_xact_lock(hashtextextended(${"command-operation:" + operationId}, 0))
  `);
}

export async function findCommandOperation(tx: any, operationId: string) {
  const [operation] = await tx.select().from(commandOperationsTable)
    .where(eq(commandOperationsTable.operationId, operationId));
  return operation ?? null;
}

export function fingerprintCommandPayload(canonicalPayload: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalPayload)).digest("hex");
}

export function classifyCommandOperation(
  operation: typeof commandOperationsTable.$inferSelect | null,
  binding: OperationBinding,
): "new" | "replay" | "collision" {
  if (!operation) return "new";
  return operation.actorUserId === binding.actorUserId
    && operation.command === binding.command
    && operation.targetType === binding.targetType
    && operation.targetId === binding.targetId
    && operation.payloadFingerprint === binding.payloadFingerprint
    ? "replay"
    : "collision";
}

export async function persistCommandOperation(tx: any, input: OperationBinding & {
  operationId: string;
  primaryId: number;
  resultVersion?: number;
  resultJson?: Record<string, unknown>;
}) {
  await tx.insert(commandOperationsTable).values({
    operationId: input.operationId,
    actorUserId: input.actorUserId,
    command: input.command,
    targetType: input.targetType,
    targetId: input.targetId,
    payloadFingerprint: input.payloadFingerprint,
    resultVersion: input.resultVersion ?? 1,
    resultJson: input.resultJson ?? { primaryId: input.primaryId },
  });
}

export function replayCommandResult(operation: typeof commandOperationsTable.$inferSelect): {
  primaryId: number;
  version: number;
} {
  const value = operation.resultJson as { primaryId?: unknown };
  if (operation.resultVersion !== 1 || !Number.isInteger(value?.primaryId)) {
    throw new Error("Unsupported command operation result");
  }
  return { primaryId: value.primaryId as number, version: operation.resultVersion };
}