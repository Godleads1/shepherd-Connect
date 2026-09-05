import { Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { lockSessionRevocation } from "./sessionRevocation";

// userId → set of active SSE response streams (supports multiple tabs/devices per user)
type Connection = { res: Response; sessionVersion: number; role: string };
const connections = new Map<number, Set<Connection>>();

export function addConnection(userId: number, res: Response, sessionVersion = 1, role = ""): void {
  if (!connections.has(userId)) connections.set(userId, new Set());
  connections.get(userId)!.add({ res, sessionVersion, role });
}

export function removeConnection(userId: number, res: Response): void {
  const set = connections.get(userId);
  if (!set) return;
  for (const connection of set) {
    if (connection.res === res) set.delete(connection);
  }
  if (set.size === 0) connections.delete(userId);
}

export async function pushEvent(userId: number, event: string, data: unknown): Promise<void> {
  const set = connections.get(userId);
  if (!set || set.size === 0) return;
  // This is deliberately checked immediately before every write.  A NOTIFY can
  // be delayed between instances; delivering after a committed revocation is
  // never acceptable.
  try {
    await db.transaction(async tx => {
      await lockSessionRevocation(tx, userId, true);
      const [user] = await tx.select({
        sessionVersion: usersTable.sessionVersion, role: usersTable.role,
        secondaryRoles: usersTable.secondaryRoles, isActive: usersTable.isActive, status: usersTable.status,
      }).from(usersTable).where(eq(usersTable.id, userId));
      let roles: string[] = [];
      try { roles = [user?.role ?? "", ...JSON.parse(user?.secondaryRoles ?? "[]")]; } catch { roles = [user?.role ?? ""]; }
      const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      for (const connection of set) {
        if (!user || !user.isActive || user.status !== "active" ||
          user.sessionVersion !== connection.sessionVersion || !roles.includes(connection.role)) {
          set.delete(connection);
          try { connection.res.end(); } catch { /* already closed */ }
          continue;
        }
        try { connection.res.write(payload); } catch { set.delete(connection); }
      }
    });
  } catch {
    // Fail closed.  Keeping an unverifiable stream open risks later callers
    // assuming it was authorized.
    closeUserConnections(userId);
    return;
  }
  if (set.size === 0) connections.delete(userId);
}

export function closeUserConnections(userId: number): void {
  const set = connections.get(userId);
  if (!set) return;
  connections.delete(userId);
  for (const { res } of set) {
    try { res.end(); } catch { /* already closed */ }
  }
}

export async function pushEventToUsers(userIds: number[], event: string, data: unknown): Promise<void> {
  for (const userId of userIds) {
    await pushEvent(userId, event, data);
  }
}

/** How many users currently have an open SSE connection (for monitoring). */
export function connectionCount(): number {
  let total = 0;
  for (const set of connections.values()) total += set.size;
  return total;
}
