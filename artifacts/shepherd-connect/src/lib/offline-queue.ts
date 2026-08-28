const QUEUE_KEY_PREFIX = "shepherd_offline_checkin_queue";

export type OriginatingRole =
  | "super_admin"
  | "admin"
  | "teacher"
  | "support"
  | "attendant"
  | "parent";

export interface QueuedCheckIn {
  readonly eventId: string;
  readonly originatingUserId: number;
  readonly originatingRole: OriginatingRole;
  readonly operation: "checkin";
  childId: number;
  classId: number;
  serviceDate: string;
  serviceSlot: string;
  childName: string;
  queuedAt: string;
  /** Set when this entry is one half of a deliberate both-services booking. */
  bothServices?: boolean;
}

export type CheckInQueuePayload = Omit<
  QueuedCheckIn,
  "eventId" | "originatingUserId" | "originatingRole" | "operation" | "queuedAt"
>;

function queueKey(userId: number) {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error("An authenticated user id is required for the offline queue");
  }
  return `${QUEUE_KEY_PREFIX}:${userId}`;
}

export function enqueueCheckIn(
  userId: number,
  role: OriginatingRole,
  item: CheckInQueuePayload,
) {
  const queue = getQueue(userId);
  const entry: QueuedCheckIn = {
    ...item,
    eventId: crypto.randomUUID(),
    originatingUserId: userId,
    originatingRole: role,
    operation: "checkin",
    queuedAt: new Date().toISOString(),
  };
  queue.push(entry);
  localStorage.setItem(queueKey(userId), JSON.stringify(queue));
  return entry.eventId;
}

export function getQueue(userId: number): QueuedCheckIn[] {
  try {
    const raw = localStorage.getItem(queueKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is QueuedCheckIn =>
        typeof item === "object" &&
        item !== null &&
        (item as QueuedCheckIn).originatingUserId === userId &&
        (item as QueuedCheckIn).operation === "checkin",
    );
  } catch {
    return [];
  }
}

export function removeFromQueue(userId: number, eventId: string) {
  const queue = getQueue(userId).filter((item) => item.eventId !== eventId);
  localStorage.setItem(queueKey(userId), JSON.stringify(queue));
}

export function clearQueue(userId: number) {
  localStorage.removeItem(queueKey(userId));
}
