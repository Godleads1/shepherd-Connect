export type PendingEmergencyUpdate = {
  operationId: string;
  emergencyId: number;
  createdAt: number;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const storageKey = (userId: number) => `shepherd.emergency-update.pending.${userId}`;

export function readPendingEmergencyUpdate(userId: number): PendingEmergencyUpdate | null {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(storageKey(userId)) || "null");
    return typeof parsed?.operationId === "string"
      && UUID_PATTERN.test(parsed.operationId)
      && Number.isInteger(parsed?.emergencyId)
      && Number.isFinite(parsed?.createdAt)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function writePendingEmergencyUpdate(userId: number, pending: PendingEmergencyUpdate): void {
  sessionStorage.setItem(storageKey(userId), JSON.stringify(pending));
}

export function clearPendingEmergencyUpdate(userId: number): void {
  sessionStorage.removeItem(storageKey(userId));
}