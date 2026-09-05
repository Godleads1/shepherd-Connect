export type PendingSafeguardingOperation = {
  operationId: string;
  createdAt: number;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const storageKey = (userId: number) => `shepherd.safeguarding.pending.${userId}`;

export function readPendingSafeguardingOperation(userId: number): PendingSafeguardingOperation | null {
  try {
    const pending = JSON.parse(sessionStorage.getItem(storageKey(userId)) || "null");
    return typeof pending?.operationId === "string"
      && UUID_PATTERN.test(pending.operationId)
      && Number.isFinite(pending.createdAt)
      ? pending
      : null;
  } catch {
    return null;
  }
}

export function writePendingSafeguardingOperation(userId: number, pending: PendingSafeguardingOperation): void {
  sessionStorage.setItem(storageKey(userId), JSON.stringify(pending));
}

export function clearPendingSafeguardingOperation(userId: number): void {
  sessionStorage.removeItem(storageKey(userId));
}