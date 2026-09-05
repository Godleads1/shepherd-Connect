const PREFIX = "pickup-delegate-pending:";

export function readPendingPickupDelegateOperation(userId: number | null): string | null {
  return userId === null ? null : localStorage.getItem(`${PREFIX}${userId}`);
}

export function writePendingPickupDelegateOperation(userId: number | null, operationId: string): void {
  if (userId !== null) localStorage.setItem(`${PREFIX}${userId}`, operationId);
}

export function clearPendingPickupDelegateOperation(userId: number | null): void {
  if (userId !== null) localStorage.removeItem(`${PREFIX}${userId}`);
}