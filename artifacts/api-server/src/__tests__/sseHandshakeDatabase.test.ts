import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import eventsRouter from "../routes/events";
import { connectionCount } from "../lib/sse";
import { createSessionInvalidationCoordinator } from "../lib/sessionInvalidation";
import { SESSION_REVOCATION_LOCK_NAMESPACE, lockSessionRevocation, notifySessionRevocation } from "../lib/sessionRevocation";

const suite = process.env.RUN_DATABASE_ROLE_TESTS === "true" ? describe : describe.skip;
const prefix = `sse-handshake-${process.pid}-${Date.now()}`;
const handler = (eventsRouter as any).stack.find((layer: any) => layer.route?.path === "/events").route.stack[0].handle;

function fakeResponse() {
  const res: any = new EventEmitter();
  res.statusCode = 200;
  res.status = vi.fn((status: number) => { res.statusCode = status; return res; });
  res.json = vi.fn(() => res);
  res.clearCookie = vi.fn();
  res.setHeader = vi.fn();
  res.flushHeaders = vi.fn();
  res.write = vi.fn();
  res.end = vi.fn();
  return res;
}

suite("ordered SSE handshake", () => {
  let userId: number;
  const baseline = connectionCount();
  const coordinator = createSessionInvalidationCoordinator(pool as any);

  beforeAll(async () => {
    const inserted = await db.execute(sql`INSERT INTO users
      (email, password_hash, first_name, last_name, role, secondary_roles, status, is_active)
      VALUES (${`${prefix}@example.test`}, 'unused', 'SSE', 'Handshake', 'parent', '["support"]', 'active', true)
      RETURNING id`);
    userId = Number(inserted.rows[0]!.id);
    coordinator.start();
    await new Promise(resolve => setTimeout(resolve, 100));
  });
  afterAll(async () => {
    await coordinator.stop();
    await db.execute(sql`DELETE FROM sse_tickets WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM audit_logs WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM users WHERE id = ${userId}`);
  });

  async function ticket(role = "parent") {
    const plaintext = randomUUID();
    await db.execute(sql`INSERT INTO sse_tickets
      (ticket_hash, user_id, selected_role, session_version, purpose, expires_at)
      VALUES (${createHash("sha256").update(plaintext).digest("hex")}, ${userId}, ${role}, 1, 'sse', now() + interval '30 seconds')`);
    return plaintext;
  }
  async function requestWith(plaintext: string) {
    const req: any = new EventEmitter();
    req.headers = { cookie: `sse_ticket=${plaintext}` };
    const res = fakeResponse();
    const promise = handler(req, res);
    return { req, res, promise };
  }
  async function staleRace(mutation: string) {
    await db.execute(sql`UPDATE users SET session_version=1, status='active', is_active=true,
      role='parent', secondary_roles='["support"]' WHERE id=${userId}`);
    const plaintext = await ticket(mutation === "role" ? "support" : "parent");
    const blocker = await pool.connect();
    await blocker.query("BEGIN");
    await blocker.query("SELECT pg_advisory_xact_lock($1,$2)", [SESSION_REVOCATION_LOCK_NAMESPACE, userId]);
    const attempt = await requestWith(plaintext);
    await new Promise(resolve => setTimeout(resolve, 50));
    if (mutation === "version") await blocker.query("UPDATE users SET session_version=2 WHERE id=$1", [userId]);
    if (mutation === "status") await blocker.query("UPDATE users SET status='suspended', is_active=false WHERE id=$1", [userId]);
    if (mutation === "role") await blocker.query("UPDATE users SET secondary_roles='[]' WHERE id=$1", [userId]);
    await blocker.query("COMMIT");
    blocker.release();
    await attempt.promise;
    expect(attempt.res.write).not.toHaveBeenCalled();
    expect(attempt.res.statusCode).toBe(401);
    expect(connectionCount()).toBe(baseline);
  }

  it("rejects session revocation committed before registration", () => staleRace("version"));
  it("rejects suspension/inactivation committed before registration", () => staleRace("status"));
  it("rejects effective-role removal committed before registration", () => staleRace("role"));

  it("registers a valid handshake and a queued revocation closes it", async () => {
    await db.execute(sql`UPDATE users SET session_version=1,status='active',is_active=true,role='parent',secondary_roles='[]' WHERE id=${userId}`);
    const attempt = await requestWith(await ticket());
    await attempt.promise;
    expect(attempt.res.write).toHaveBeenCalledWith(expect.stringContaining("event: connected"));
    expect(connectionCount()).toBe(baseline + 1);
    await db.transaction(async tx => {
      await lockSessionRevocation(tx, userId);
      await tx.execute(sql`UPDATE users SET session_version=2 WHERE id=${userId}`);
      await notifySessionRevocation(tx, userId);
    });
    for (let i = 0; i < 40 && !attempt.res.end.mock.calls.length; i++) await new Promise(resolve => setTimeout(resolve, 25));
    expect(attempt.res.end).toHaveBeenCalled();
    expect(connectionCount()).toBe(baseline);
    attempt.req.emit("close");
  });
});