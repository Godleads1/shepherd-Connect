const QUEUE_KEY = "shepherd_offline_checkin_queue";

export interface QueuedCheckIn {
  id: string;
  type: "checkin" | "checkout";
  childId: number;
  classId: number;
  serviceDate: string;
  serviceSlot: string;
  childName: string;
  queuedAt: string;
}

export function enqueueCheckIn(item: Omit<QueuedCheckIn, "id" | "queuedAt">) {
  const queue = getQueue();
  const entry: QueuedCheckIn = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    queuedAt: new Date().toISOString(),
  };
  queue.push(entry);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return entry.id;
}

export function getQueue(): QueuedCheckIn[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedCheckIn[]) : [];
  } catch {
    return [];
  }
}

export function removeFromQueue(id: string) {
  const queue = getQueue().filter((item) => item.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
}
