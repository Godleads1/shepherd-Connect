import { and, eq, sql } from "drizzle-orm";
import { checkoutOperationsTable } from "@workspace/db";
import { CheckOutResponse } from "@workspace/api-zod";

export const CHECKOUT_COMMAND = "attendance_checkout" as const;

export async function lockCheckoutOperation(tx: any, operationId: string): Promise<void> {
  await tx.execute(sql`
    SELECT pg_advisory_xact_lock(hashtextextended(${"checkout-operation:" + operationId}, 0))
  `);
}

export async function findCheckoutOperation(tx: any, operationId: string) {
  const [operation] = await tx
    .select()
    .from(checkoutOperationsTable)
    .where(eq(checkoutOperationsTable.operationId, operationId));
  return operation ?? null;
}

export async function findBoundCheckoutOperation(tx: any, input: {
  operationId: string;
  actorUserId: number;
  attendanceId: number;
}) {
  const [operation] = await tx
    .select()
    .from(checkoutOperationsTable)
    .where(and(
      eq(checkoutOperationsTable.operationId, input.operationId),
      eq(checkoutOperationsTable.actorUserId, input.actorUserId),
      eq(checkoutOperationsTable.command, CHECKOUT_COMMAND),
      eq(checkoutOperationsTable.attendanceId, input.attendanceId),
    ));
  return operation ?? null;
}

export function checkoutOperationMatches(operation: typeof checkoutOperationsTable.$inferSelect, input: {
  actorUserId: number;
  attendanceId: number;
}): boolean {
  return operation.actorUserId === input.actorUserId
    && operation.command === CHECKOUT_COMMAND
    && operation.attendanceId === input.attendanceId;
}

export function serializeCheckoutResult(result: unknown) {
  const serialized = JSON.parse(JSON.stringify(result));
  if (serialized?.attendance && typeof serialized.attendance === "object") {
    // Child/class enrichment can include names, medical notes, photos, or
    // biometric descriptors. The custody binding lives in its dedicated
    // checkout_operations column. None of it belongs in the replay snapshot.
    delete serialized.attendance.child;
    delete serialized.attendance.class;
    delete serialized.attendance.custodyEpisodeId;
  }
  return CheckOutResponse.parse(serialized);
}

export function replayCheckoutOperation(operation: typeof checkoutOperationsTable.$inferSelect) {
  const original = CheckOutResponse.parse(operation.authoritativeResult);
  return CheckOutResponse.parse({
    ...original,
    outcome: "already_applied",
    alreadyApplied: true,
    resolvedPickupRequestIds: operation.resolvedPickupRequestIds,
  });
}

export async function persistCheckoutOperation(tx: any, input: {
  operationId: string;
  actorUserId: number;
  attendanceId: number;
  custodyEpisodeId: number | null;
  result: ReturnType<typeof serializeCheckoutResult>;
}) {
  await tx.insert(checkoutOperationsTable).values({
    operationId: input.operationId,
    actorUserId: input.actorUserId,
    command: CHECKOUT_COMMAND,
    attendanceId: input.attendanceId,
    custodyEpisodeId: input.custodyEpisodeId,
    originalOutcome: input.result.outcome,
    authoritativeResult: input.result,
    resolvedPickupRequestIds: input.result.resolvedPickupRequestIds,
  });
}