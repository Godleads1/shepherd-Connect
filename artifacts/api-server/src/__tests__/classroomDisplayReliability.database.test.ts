import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, pool } from "@workspace/db";
import { sql } from "drizzle-orm";
import { ClassroomDisplayListenerCoordinator } from "../services/classroomDisplayListenerCoordinator";

const databaseDescribe = process.env.RUN_DATABASE_ATTENDANCE_TESTS === "true" ? describe : describe.skip;
const firstClassId = 710001;
const secondClassId = 710002;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

databaseDescribe("classroom display multi-process invalidation", () => {
  const refreshedA: number[] = [];
  const refreshedB: number[] = [];
  let listenerA: any;
  let listenerB: any;
  const processA = new ClassroomDisplayListenerCoordinator({
    connect: async () => {
      listenerA = await pool.connect();
      return {
        query: listenerA.query.bind(listenerA),
        on: listenerA.on.bind(listenerA),
        // A process crash destroys its dedicated LISTEN connection rather than
        // returning it to the pool with its subscription still alive.
        release: () => listenerA.release(new Error("test listener disconnect")),
      };
    },
    reconcile: async classId => { refreshedA.push(classId); },
    pollMs: 60_000,
  });
  const processB = new ClassroomDisplayListenerCoordinator({
    connect: async () => {
      listenerB = await pool.connect();
      return {
        query: listenerB.query.bind(listenerB),
        on: listenerB.on.bind(listenerB),
        release: () => listenerB.release(new Error("test listener disconnect")),
      };
    },
    reconcile: async classId => { refreshedB.push(classId); },
    pollMs: 60_000,
  });

  beforeAll(async () => {
    processA.setConnected(firstClassId, true);
    processB.setConnected(firstClassId, true);
    await Promise.all([processA.start(), processB.start()]);
    refreshedA.length = 0; refreshedB.length = 0;
  });
  afterAll(() => { processA.stop(); processB.stop(); });

  it("reconciles fake clients on two independent production listener coordinators", async () => {
    await db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_notify('classroom_display_refresh', ${String(firstClassId)})`);
    });
    for (let attempts = 0; attempts < 40 && (!refreshedA.length || !refreshedB.length); attempts += 1) await wait(25);
    expect(refreshedA).toEqual([firstClassId]);
    expect(refreshedB).toEqual([firstClassId]);
  });

  it("does not reconcile another class for a target-class invalidation", async () => {
    refreshedA.length = 0; refreshedB.length = 0;
    await db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_notify('classroom_display_refresh', ${String(secondClassId)})`);
    });
    await wait(100);
    expect(refreshedA).toEqual([]);
    expect(refreshedB).toEqual([]);
  });

  it("reconciles after one process misses an event while its listener restarts", async () => {
    refreshedA.length = 0; refreshedB.length = 0;
    const oldListenerA = listenerA;
    oldListenerA.emit("end"); // destroys process A's real PostgreSQL session
    expect(processA.isListening()).toBe(false);
    oldListenerA.emit("notification", { channel: "classroom_display_refresh", payload: String(firstClassId) });
    await wait(10);
    expect(refreshedA).toEqual([]);
    await db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_notify('classroom_display_refresh', ${String(firstClassId)})`);
    });
    for (let attempts = 0; attempts < 70 && (!refreshedA.length || !refreshedB.length); attempts += 1) await wait(25);
    expect(refreshedB).toEqual([firstClassId]);
    // The coordinator reconnects after one second and rereads every locally
    // connected class; this recovery does not rely on replaying NOTIFY.
    expect(refreshedA).toEqual([firstClassId]);
    expect(processA.isListening()).toBe(true);
    expect(listenerA).not.toBe(oldListenerA);
  });
});