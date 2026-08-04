import { Response } from "express";

// userId → set of active SSE response streams (supports multiple tabs/devices per user)
const connections = new Map<number, Set<Response>>();

export function addConnection(userId: number, res: Response): void {
  if (!connections.has(userId)) connections.set(userId, new Set());
  connections.get(userId)!.add(res);
}

export function removeConnection(userId: number, res: Response): void {
  const set = connections.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) connections.delete(userId);
}

export function pushEvent(userId: number, event: string, data: unknown): void {
  const set = connections.get(userId);
  if (!set || set.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try {
      res.write(payload);
    } catch {
      // Connection already gone — clean it up
      set.delete(res);
    }
  }
  if (set.size === 0) connections.delete(userId);
}

export function pushEventToUsers(userIds: number[], event: string, data: unknown): void {
  for (const userId of userIds) {
    pushEvent(userId, event, data);
  }
}

/** How many users currently have an open SSE connection (for monitoring). */
export function connectionCount(): number {
  let total = 0;
  for (const set of connections.values()) total += set.size;
  return total;
}
