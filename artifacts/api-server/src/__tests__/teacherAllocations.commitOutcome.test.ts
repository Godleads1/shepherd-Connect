import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  const tables = {
    allocations: { id: "allocation.id", teacherId: "allocation.teacherId", classId: "allocation.classId" },
    teachers: { id: "teacher.id" },
    classes: { id: "class.id" },
    users: { id: "user.id", isActive: "user.isActive", role: "user.role" },
  };
  return {
    tables,
    committed: [] as Array<Record<string, unknown>>,
    failFormatter: false,
    outboxCalls: 0,
    failOutboxAt: 0,
    nextId: 10,
  };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  or: vi.fn(() => ({})),
  sql: vi.fn(() => ({})),
}));

vi.mock("@workspace/api-zod", () => ({
  CreateTeacherAllocationBody: { safeParse: (data: unknown) => ({ success: true, data }) },
  UpdateTeacherAllocationBody: { safeParse: (data: unknown) => ({ success: true, data }) },
  ListTeacherAllocationsQueryParams: { safeParse: (data: unknown) => ({ success: true, data }) },
}));

vi.mock("../middlewares/auth", () => ({
  authMiddleware: (req: { user?: unknown }, _res: unknown, next: () => void) => {
    req.user = { userId: 1, role: "admin" };
    next();
  },
  requireRoles: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../services/notificationOutbox", () => ({
  createNotificationDelivery: vi.fn(async () => {
    harness.outboxCalls++;
    if (harness.failOutboxAt === harness.outboxCalls) throw new Error("injected outbox failure");
    return { notificationId: 1, outbox: [], inserted: true };
  }),
}));

function transactionClient(snapshot: Array<Record<string, unknown>>) {
  const rowsFor = (table: unknown) => {
    if (harness.failFormatter && table === harness.tables.teachers) {
      throw new Error("injected formatter read failure");
    }
    if (table === harness.tables.teachers) return [{ id: 3, userId: 4 }];
    if (table === harness.tables.users) {
      return [{ id: 4, firstName: "Test", lastName: "Teacher", primaryClassId: 5, isActive: true, role: "admin" }];
    }
    if (table === harness.tables.classes) return [{ id: 5, name: "Test Class" }];
    return snapshot;
  };
  return {
    insert: () => ({
      values: (value: Record<string, unknown>) => ({
        onConflictDoNothing: () => ({
          returning: async () => {
            const allocation = { ...value, id: harness.nextId++, createdAt: new Date() };
            snapshot.push(allocation);
            return [allocation];
          },
        }),
      }),
    }),
    update: () => ({
      set: (updates: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            const allocation = snapshot[0];
            if (!allocation) return [];
            const updated = { ...allocation, ...updates };
            snapshot[0] = updated;
            return [updated];
          },
        }),
      }),
    }),
    select: () => ({
      from: (table: unknown) => {
        const result = () => rowsFor(table);
        return {
          where: async () => result(),
          then: (resolve: (rows: unknown[]) => unknown, reject: (error: unknown) => unknown) => {
            try { return Promise.resolve(resolve(result())); } catch (error) { return Promise.resolve(reject(error)); }
          },
        };
      },
    }),
    execute: async () => ({ rows: [{ id: "1" }] }),
  };
}

vi.mock("@workspace/db", () => ({
  teacherAllocationsTable: harness.tables.allocations,
  teachersTable: harness.tables.teachers,
  classesTable: harness.tables.classes,
  usersTable: harness.tables.users,
  db: {
    select: () => transactionClient(harness.committed).select(),
    transaction: async (callback: (tx: ReturnType<typeof transactionClient>) => Promise<unknown>) => {
      const snapshot = harness.committed.map(row => ({ ...row }));
      const result = await callback(transactionClient(snapshot));
      harness.committed = snapshot;
      return result;
    },
  },
}));

import teacherAllocationsRouter from "../routes/teacherAllocations";

const app = express();
app.use(express.json());
app.use(teacherAllocationsRouter);

describe("teacher allocation commit outcomes", () => {
  beforeEach(() => {
    harness.committed = [];
    harness.failFormatter = false;
    harness.outboxCalls = 0;
    harness.failOutboxAt = 0;
    harness.nextId = 10;
  });

  it("rolls back create when required response enrichment fails", async () => {
    harness.failFormatter = true;
    const response = await request(app).post("/teacher-allocations").send({
      teacherId: 3, classId: 5, serviceDate: "2026-05-03", serviceSlot: "7am",
    });
    expect(response.status).toBe(500);
    expect(harness.committed).toHaveLength(0);
  });

  it("rolls back update when required response enrichment fails", async () => {
    harness.committed = [{
      id: 10, teacherId: 3, classId: 5, serviceDate: "2026-05-03",
      serviceSlot: "7am", status: "scheduled", createdAt: new Date(),
    }];
    harness.failFormatter = true;
    const response = await request(app).put("/teacher-allocations/10").send({ status: "confirmed" });
    expect(response.status).toBe(500);
    expect(harness.committed[0]?.status).toBe("scheduled");
  });

  it("rolls back a swap when required response enrichment fails", async () => {
    harness.committed = [{
      id: 10, teacherId: 3, classId: 5, serviceDate: "2026-05-03",
      serviceSlot: "7am", status: "scheduled", createdAt: new Date(),
    }];
    harness.failFormatter = true;
    const response = await request(app).post("/teacher-allocations/10/swap").send({ newTeacherId: 8 });
    expect(response.status).toBe(500);
    expect(harness.committed[0]?.teacherId).toBe(3);
  });

  it("rolls back unavailability when required response enrichment fails", async () => {
    harness.committed = [{
      id: 10, teacherId: 3, classId: 5, serviceDate: "2026-05-03",
      serviceSlot: "7am", status: "scheduled", createdAt: new Date(),
    }];
    harness.failFormatter = true;
    const response = await request(app).post("/teacher-allocations/10/mark-unavailable").send({});
    expect(response.status).toBe(500);
    expect(harness.committed[0]?.status).toBe("scheduled");
  });

  it("commits assign-duty only with its required outbox intent", async () => {
    const response = await request(app).post("/teacher-allocations/assign-duty").send({
      serviceDate: "2026-05-03", serviceSlots: ["7am"], teacherIds: [3],
    });
    expect(response.status).toBe(200);
    expect(harness.committed).toHaveLength(1);
    expect(harness.outboxCalls).toBe(1);
  });

  it("preserves assign-duty partial commits when a later allocation outbox fails", async () => {
    harness.failOutboxAt = 2;
    const response = await request(app).post("/teacher-allocations/assign-duty").send({
      serviceDate: "2026-05-03", serviceSlots: ["7am"], teacherIds: [3, 8],
    });
    expect(response.status).toBe(500);
    expect(harness.committed).toHaveLength(1);
  });

  it("commits auto-schedule with its required outbox intent", async () => {
    const response = await request(app).post("/teacher-allocations/auto-schedule").send({
      serviceDate: "2026-05-03", serviceSlots: ["7am"], teachersPerClass: 1,
    });
    expect(response.status).toBe(200);
    expect(harness.committed).toHaveLength(1);
    expect(harness.outboxCalls).toBe(1);
  });

  it("rolls back the current auto-schedule allocation when its outbox fails", async () => {
    harness.failOutboxAt = 1;
    const response = await request(app).post("/teacher-allocations/auto-schedule").send({
      serviceDate: "2026-05-03", serviceSlots: ["7am"], teachersPerClass: 1,
    });
    expect(response.status).toBe(500);
    expect(harness.committed).toHaveLength(0);
  });

  it("rolls back swap when its required outbox fails", async () => {
    harness.committed = [{
      id: 10, teacherId: 3, classId: 5, serviceDate: "2026-05-03",
      serviceSlot: "7am", status: "scheduled", createdAt: new Date(),
    }];
    harness.failOutboxAt = 1;
    const response = await request(app).post("/teacher-allocations/10/swap").send({ newTeacherId: 8 });
    expect(response.status).toBe(500);
    expect(harness.committed[0]?.teacherId).toBe(3);
  });

  it("suppresses self-swap recipients while preserving the allowed command", async () => {
    harness.committed = [{
      id: 10, teacherId: 3, classId: 5, serviceDate: "2026-05-03",
      serviceSlot: "7am", status: "scheduled", createdAt: new Date(),
    }];
    const response = await request(app).post("/teacher-allocations/10/swap").send({ newTeacherId: 3 });
    expect(response.status).toBe(200);
    expect(harness.outboxCalls).toBe(0);
    expect(harness.committed[0]?.teacherId).toBe(3);
  });

  it("rolls back unavailability when its required outbox fails", async () => {
    harness.committed = [{
      id: 10, teacherId: 3, classId: 5, serviceDate: "2026-05-03",
      serviceSlot: "7am", status: "scheduled", createdAt: new Date(),
    }];
    harness.failOutboxAt = 1;
    const response = await request(app).post("/teacher-allocations/10/mark-unavailable").send({});
    expect(response.status).toBe(500);
    expect(harness.committed[0]?.status).toBe("scheduled");
  });
});