const PREFIX = "family-assist-delegate-pending:";

export function familyAssistActorId(token: string | null): number | null {
  if (!token) return null;
  try {
    const claims = JSON.parse(atob(token.split(".")[1]));
    return Number.isInteger(claims.userId) ? claims.userId : null;
  } catch {
    return null;
  }
}

export function readPendingFamilyAssistDelegateOperation(userId: number | null): string | null {
  return userId === null ? null : localStorage.getItem(`${PREFIX}${userId}`);
}

export function writePendingFamilyAssistDelegateOperation(userId: number | null, operationId: string): void {
  if (userId !== null) localStorage.setItem(`${PREFIX}${userId}`, operationId);
}

export function clearPendingFamilyAssistDelegateOperation(userId: number | null): void {
  if (userId !== null) localStorage.removeItem(`${PREFIX}${userId}`);
}