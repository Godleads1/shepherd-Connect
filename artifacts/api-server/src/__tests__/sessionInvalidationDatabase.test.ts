import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, pool } from "@workspace/db";
import { sql } from "drizzle-orm";
import { createSessionInvalidationCoordinator, type SessionInvalidationCoordinator } from "../lib/sessionInvalidation";
import { notifySessionRevocation } from "../lib/sessionRevocation";

const enabled = process.env.RUN_DATABASE_ROLE_TESTS === "true";
const suite = enabled ? describe : describe.skip;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function eventually(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (predicate()) return;
    await sleep(25);
  }
  throw new Error("notification was not observed");
}

suite("PostgreSQL session invalidation", () => {
  let first: SessionInvalidationCoordinator;
  let second: SessionInvalidationCoordinator;
  const firstClosed: number[] = [];
  const secondClosed: number[] = [];

  beforeAll(async () => {
    first = createSessionInvalidationCoordinator(pool as any, id => firstClosed.push(id), 20);
    second = createSessionInvalidationCoordinator(pool as any, id => secondClosed.push(id), 20);
    first.start();
    second.start();
    await sleep(100);
  });
  afterAll(async () => {
    await Promise.all([first.stop(), second.stop()]);
  });

  it("delivers a committed invalidation independently to both coordinators", async () => {
    await db.transaction(async tx => notifySessionRevocation(tx, 991001));
    await eventually(() => firstClosed.includes(991001) && secondClosed.includes(991001));
  });

  it("does not deliver a notification from a rolled-back transaction", async () => {
    await expect(db.transaction(async tx => {
      await notifySessionRevocation(tx, 991002);
      throw new Error("rollback");
    })).rejects.toThrow("rollback");
    await sleep(100);
    expect(firstClosed).not.toContain(991002);
    expect(secondClosed).not.toContain(991002);
  });

  it("ignores malformed payloads without disrupting later notifications", async () => {
    await db.execute(sql`SELECT pg_notify('session_revocations', 'not-json')`);
    await db.transaction(async tx => notifySessionRevocation(tx, 991003));
    await eventually(() => firstClosed.includes(991003) && secondClosed.includes(991003));
  });

  it("reconnects after its PostgreSQL listener backend is terminated", async () => {
    const originalPid = first.state().backendPid;
    expect(originalPid).toBeTypeOf("number");
    await db.execute(sql`SELECT pg_terminate_backend(${originalPid!})`);
    await eventually(() => {
      const state = first.state();
      return state.connected && typeof state.backendPid === "number" && state.backendPid !== originalPid;
    });
    const before = firstClosed.filter(id => id === 991004).length;
    await db.transaction(async tx => notifySessionRevocation(tx, 991004));
    await eventually(() => firstClosed.filter(id => id === 991004).length === before + 1);
    expect(firstClosed.filter(id => id === 991004)).toHaveLength(before + 1);
  });
});