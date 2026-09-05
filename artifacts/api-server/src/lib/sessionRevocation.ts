import { sql } from "drizzle-orm";

// Dedicated two-key advisory-lock namespace.  Lock order is always:
// session-revocation user lock, then users row/query.  Revokers take exclusive;
// protected SSE writes take shared.  Nothing may await network I/O while held.
export const SESSION_REVOCATION_LOCK_NAMESPACE = 0x53534552;

type Executor = { execute(query: unknown): Promise<unknown> };

export async function lockSessionRevocation(tx: Executor, userId: number, shared = false): Promise<void> {
  await tx.execute(shared
    ? sql`SELECT pg_advisory_xact_lock_shared(${SESSION_REVOCATION_LOCK_NAMESPACE}, ${userId})`
    : sql`SELECT pg_advisory_xact_lock(${SESSION_REVOCATION_LOCK_NAMESPACE}, ${userId})`);
}

export async function notifySessionRevocation(tx: Executor, userId: number): Promise<void> {
  await tx.execute(sql`SELECT pg_notify('session_revocations', ${JSON.stringify({ userId })})`);
}