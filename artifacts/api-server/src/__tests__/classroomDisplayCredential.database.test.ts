import { createHash } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, pool } from "@workspace/db";
import { sql } from "drizzle-orm";
import app from "../app";
import {
  addClassroomDisplayClient,
  broadcastToClass,
  reconcileClassroomDisplayAuthoritativeState,
  removeClassroomDisplayClient,
  type ClassroomDisplayClient,
} from "../services/classroomDisplayAlerts";
import { ClassroomDisplayListenerCoordinator } from "../services/classroomDisplayListenerCoordinator";

const databaseDescribe = process.env.RUN_DATABASE_ATTENDANCE_TESTS === "true" ? describe : describe.skip;
const prefix = `display-scope-${Date.now()}`;
const tokenA = `class-a-${prefix}`;
let userId = 0;
let classA = 0;
let classB = 0;
let familyId = 0;
let childId = 0;
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

databaseDescribe("classroom display credential class isolation", () => {
  beforeAll(async () => {
    userId = Number((await db.execute(sql`
      INSERT INTO users (email,password_hash,first_name,last_name,role,status,is_active)
      VALUES (${`${prefix}@test`},'x','Display','Admin','admin','active',true) RETURNING id
    `)).rows[0].id);
    classA = Number((await db.execute(sql`
      INSERT INTO classes (name,age_min,age_max,capacity,room_location,service_slot)
      VALUES (${`${prefix}-a`},1,12,30,'A','7am') RETURNING id
    `)).rows[0].id);
    classB = Number((await db.execute(sql`
      INSERT INTO classes (name,age_min,age_max,capacity,room_location,service_slot)
      VALUES (${`${prefix}-b`},1,12,30,'B','7am') RETURNING id
    `)).rows[0].id);
    familyId = Number((await db.execute(sql`
      INSERT INTO families (family_code,parent_1_id)
      VALUES (${`DS-${prefix.slice(-8)}`},${userId}) RETURNING id
    `)).rows[0].id);
    childId = Number((await db.execute(sql`
      INSERT INTO children (family_id,first_name,last_name,dob,gender,current_class_id)
      VALUES (${familyId},'Authoritative','Child','2020-01-01','female',${classA}) RETURNING id
    `)).rows[0].id);
    await db.execute(sql`
      INSERT INTO classroom_display_tokens (class_id,token_hash,issued_by,expires_at)
      VALUES (${classA},${createHash("sha256").update(tokenA).digest("hex")},${userId},${new Date("2020-01-01T00:00:00Z")})
    `);
  });
  afterAll(async () => {
    await db.execute(sql`DELETE FROM pickup_requests WHERE child_id=${childId}`);
    await db.execute(sql`DELETE FROM classroom_display_tokens WHERE class_id IN (${classA},${classB})`);
    await db.execute(sql`DELETE FROM children WHERE id=${childId}`);
    await db.execute(sql`DELETE FROM families WHERE id=${familyId}`);
    await db.execute(sql`DELETE FROM classes WHERE id IN (${classA},${classB})`);
    await db.execute(sql`DELETE FROM users WHERE id=${userId}`);
  });

  it("accepts an old unrevoked credential for file access despite its legacy expiry", async () => {
    const response = await request(app)
      .get(`/api/pickup-requests/display-file/${classA}`)
      .query({ displayToken: tokenA })
      .expect(404);
    expect(response.body.message).toBe("No file is set for this classroom display");
  });

  it("still rejects revoked credentials for files and stream delivery", async () => {
    const writes: string[] = [];
    const client: ClassroomDisplayClient = {
      displayToken: tokenA,
      ready: true,
      res: { write: (value: string) => writes.push(value), end: () => {} },
    };
    await db.execute(sql`UPDATE classroom_display_tokens SET revoked_at=now() WHERE class_id=${classA}`);
    addClassroomDisplayClient(classA, client);
    try {
      await request(app).get(`/api/pickup-requests/display-file/${classA}`)
        .query({ displayToken: tokenA }).expect(401);
      await request(app).get(`/api/pickup-requests/stream/${classA}`)
        .query({ displayToken: tokenA }).expect(401);
      await broadcastToClass(classA, { type: "private-test-payload" });
      expect(writes.join("")).toContain("event: revoked");
      expect(writes.join("")).not.toContain("private-test-payload");
    } finally {
      removeClassroomDisplayClient(classA, client);
      await db.execute(sql`UPDATE classroom_display_tokens SET revoked_at=null WHERE class_id=${classA}`);
    }
  });

  it("denies a class-A token on class-B stream without opening SSE", async () => {
    const response = await request(app)
      .get(`/api/pickup-requests/stream/${classB}`)
      .query({ displayToken: tokenA })
      .expect(401);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.text).not.toContain("text/event-stream");
  });

  it("denies the same cross-class token on display-file access", async () => {
    await request(app)
      .get(`/api/pickup-requests/display-file/${classB}`)
      .query({ displayToken: tokenA })
      .expect(401);
  });

  it("production authoritative reconciliation writes a refresh only to the ready class-A client", async () => {
    const writes: string[] = [];
    const client: ClassroomDisplayClient = {
      displayToken: tokenA,
      ready: true,
      res: { write: (payload: string) => writes.push(payload), end: () => undefined },
    };
    addClassroomDisplayClient(classA, client);
    try {
      await reconcileClassroomDisplayAuthoritativeState(classA);
      expect(writes).toHaveLength(1);
      expect(JSON.parse(writes[0].slice(6))).toMatchObject({
        type: "refresh",
        queue: [],
        checkInAlerts: [],
        media: null,
      });
    } finally {
      removeClassroomDisplayClient(classA, client);
    }
  });

  it("recovers a physically missed notification through production authoritative SSE reconciliation", async () => {
    const writes: string[] = [];
    const client: ClassroomDisplayClient = {
      displayToken: tokenA,
      ready: true,
      res: { write: (payload: string) => writes.push(payload), end: () => undefined },
    };
    // This test owns an independent production coordinator, so do not also
    // enroll the fake client in the module singleton's listener.
    addClassroomDisplayClient(classA, client, false);
    const sessions: any[] = [];
    const coordinator = new ClassroomDisplayListenerCoordinator({
      connect: async () => {
        const raw = await pool.connect();
        sessions.push(raw);
        return {
          query: raw.query.bind(raw),
          on: raw.on.bind(raw),
          release: () => raw.release(new Error("destroy dedicated test listener")),
        };
      },
      reconcile: reconcileClassroomDisplayAuthoritativeState,
      pollMs: 60_000,
    });
    coordinator.setConnected(classA, true);
    try {
      await coordinator.start();
      for (let attempts = 0; attempts < 40 && writes.length === 0; attempts += 1) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      writes.length = 0; // discard startup reconciliation before the mutation
      const old = sessions[0];
      const oldPid = old.processID as number;

      // Physically destroy the underlying PostgreSQL connection, then notify
      // the coordinator of its confirmed end.
      old.release(new Error("physical socket loss"));
      old.emit("end");
      for (let attempts = 0; attempts < 40 && coordinator.isListening(); attempts += 1) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(coordinator.isListening()).toBe(false);
      for (let attempts = 0; attempts < 40; attempts += 1) {
        const active = await db.execute(sql`SELECT 1 FROM pg_stat_activity WHERE pid=${oldPid}`);
        if (active.rows.length === 0) break;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect((await db.execute(sql`SELECT 1 FROM pg_stat_activity WHERE pid=${oldPid}`)).rows).toHaveLength(0);

      // A separate pooled connection commits both authority and NOTIFY while A
      // has no listener. The destroyed socket must not produce a refresh.
      await db.transaction(async tx => {
        await tx.execute(sql`
          INSERT INTO pickup_requests
            (child_id,class_id,service_date,requested_by,child_name,parent_name,class_name)
          VALUES
            (${childId},${classA},${today},${userId},'Authoritative Child','Display Admin',${`${prefix}-a`})
        `);
        await tx.execute(sql`SELECT pg_notify('classroom_display_refresh', ${String(classA)})`);
      });
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(writes).toEqual([]);

      for (let attempts = 0; attempts < 160 && writes.length === 0; attempts += 1) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(coordinator.isListening()).toBe(true);
      expect(sessions).toHaveLength(2);
      expect(sessions[1].processID).not.toBe(oldPid);
      const refreshes = writes.map(payload => JSON.parse(payload.slice(6)));
      expect(refreshes).toContainEqual(expect.objectContaining({
        type: "refresh",
        queue: [expect.objectContaining({ childId, childName: "Authoritative Child", classId: classA })],
      }));
    } finally {
      coordinator.stop();
      removeClassroomDisplayClient(classA, client);
      await db.execute(sql`DELETE FROM pickup_requests WHERE child_id=${childId}`);
    }
  });
});