export type PendingEmergencyCreate = {
  operationId: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const storageKey = (userId: number) => `shepherd.emergency-create.pending.${userId}`;

export function readPendingEmergencyCreate(userId: number): PendingEmergencyCreate | null {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(storageKey(userId)) || "null");
    return typeof parsed?.operationId === "string" && UUID_PATTERN.test(parsed.operationId) ? { operationId: parsed.operationId } : null;
  } catch {
    return null;
  }
}

export function writePendingEmergencyCreate(userId: number, pending: PendingEmergencyCreate): void {
  sessionStorage.setItem(storageKey(userId), JSON.stringify({ operationId: pending.operationId }));
}

export function clearPendingEmergencyCreate(userId: number): void {
  sessionStorage.removeItem(storageKey(userId));
}