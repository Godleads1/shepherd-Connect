export type RateLimitedAudienceOperationResult =
  | { kind: "rate_limited" }
  | { kind: "empty" }
  | { kind: "created"; operationAt: Date; recipientIds: number[] };

/**
 * Runs the mutation portion of a rate-limited audience operation while its
 * caller holds the settings-row lock. An empty authoritative audience never
 * consumes the rate-limit timestamp.
 */
export async function runRateLimitedAudienceOperation(input: {
  lastOperationAt: Date | null | undefined;
  getRecipientIds: () => Promise<number[]>;
  setLastOperationAt: (operationAt: Date) => Promise<unknown>;
  createForRecipient: (recipientId: number, operationAt: Date) => Promise<unknown>;
  now?: () => Date;
  cooldownMs?: number;
}): Promise<RateLimitedAudienceOperationResult> {
  const now = input.now?.() ?? new Date();
  if (
    input.lastOperationAt
    && input.lastOperationAt >= new Date(now.getTime() - (input.cooldownMs ?? 60_000))
  ) {
    return { kind: "rate_limited" };
  }

  const recipientIds = await input.getRecipientIds();
  if (recipientIds.length === 0) return { kind: "empty" };

  await input.setLastOperationAt(now);
  for (const recipientId of recipientIds) {
    await input.createForRecipient(recipientId, now);
  }
  return { kind: "created", operationAt: now, recipientIds };
}