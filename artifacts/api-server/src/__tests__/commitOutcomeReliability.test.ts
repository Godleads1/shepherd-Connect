import express from "express";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  outsideSelect: [] as unknown[],
  txSelect: [] as unknown[],
  outsideMutation: [] as unknown[],
  txMutation: [] as unknown[],
  committedMutations: 0,
  warning: vi.fn(),
  notification: vi.fn(async (_options?: unknown) => undefined),
  push: vi.fn((_userId?: unknown, _event?: unknown, _data?: unknown) => undefined),
}));

function queryFrom(queue: unknown[], mutate = false) {
  let result: unknown = undefined;
  let resolved = false;
  const resolveResult = () => {
    if (!resolved) {
      result = queue.shift() ?? [];
      resolved = true;
      if (mutate) state.committedMutations++;
    }
    if (result instanceof Error) throw result;
    return result;
  };
  const query: any = {
    from: () => query,
    where: () => query,
    orderBy: () => query,
    limit: () => query,
    for: () => query,
    set: () => query,
    values: () => query,
    returning: () => query,
    then: (onFulfilled: (value: unknown) => unknown, onRejected: (error: unknown) => unknown) => {
      try {
        return Promise.resolve(onFulfilled(resolveResult()));
      } catch (error) {
        return Promise.resolve(onRejected(error));
      }
    },
  };
  return query;
}

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  or: vi.fn(() => ({})),
  like: vi.fn(() => ({})),
  inArray: vi.fn(() => ({})),
  isNotNull: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
  sql: vi.fn(() => ({})),
}));

vi.mock("@workspace/db", () => {
  const outside = {
    select: vi.fn(() => queryFrom(state.outsideSelect)),
    insert: vi.fn(() => queryFrom(state.outsideMutation, true)),
    update: vi.fn(() => queryFrom(state.outsideMutation, true)),
  };
  const tx = {
    select: vi.fn(() => queryFrom(state.txSelect)),
    insert: vi.fn(() => queryFrom(state.txMutation, true)),
    update: vi.fn(() => queryFrom(state.txMutation, true)),
    execute: vi.fn(async () => undefined),
  };
  const table = new Proxy({}, { get: (_target, property) => String(property) });
  return {
    db: {
      ...outside,
      transaction: vi.fn(async (operation: (executor: typeof tx) => Promise<unknown>) => {
        const before = state.committedMutations;
        try {
          return await operation(tx);
        } catch (error) {
          state.committedMutations = before;
          throw error;
        }
      }),
    },
    emergenciesTable: table,
    emergencyUpdatesTable: table,
    childrenTable: table,
    usersTable: table,
    notificationsTable: table,
    attendanceTable: table,
    familiesTable: table,
    classesTable: table,
    classWaitlistTable: table,
    classChangeRequestsTable: table,
    messagesTable: table,
    teachersTable: table,
    teacherAllocationsTable: table,
  };
});

vi.mock("../middlewares/auth", () => ({
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = {
      userId: 1, email: "admin@example.com", role: "admin",
      firstName: "Admin", lastName: "User",
    };
    (req as any).log = { warn: state.warning };
    next();
  },
  requireRoles: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock("../lib/notify", () => ({
  broadcastEmergency: vi.fn(async () => undefined),
  sendNotification: (options: unknown) => state.notification(options),
}));
vi.mock("../services/notificationOutbox", () => ({
  createNotificationDelivery: vi.fn(async () => undefined),
}));
vi.mock("../lib/sse", () => ({
  pushEvent: (userId: unknown, event: unknown, data: unknown) => state.push(userId, event, data),
}));
vi.mock("../lib/parentScope", () => ({
  parentOwnsChild: vi.fn(async () => true),
  getParentChildIds: vi.fn(async () => []),
}));

const now = new Date("2026-01-01T10:00:00Z");
const user = {
  id: 1, firstName: "Admin", lastName: "User", role: "admin",
  email: "admin@example.com", photoUrl: null, isActive: true,
};
const recipient = {
  id: 2, firstName: "Parent", lastName: "User", role: "parent",
  email: "parent@example.com", photoUrl: null, isActive: true,
};
const emergency = {
  id: 10, type: "medical", level: "L1", childId: null, triggeredBy: 1,
  status: "active", description: "Incident", resolutionNotes: null,
  createdAt: now, resolvedAt: null,
};
const emergencyUpdate = {
  id: 11, emergencyId: 10, userId: 1, message: "Update", updateType: "update",
  familyStatus: null, familyInstructions: null, publishedAt: null,
  publishedBy: null, eventId: null, createdAt: now,
};
const cls = {
  id: 20, name: "Class 7", description: null, ageMin: 7, ageMax: 7,
  capacity: 20, roomLocation: "Room A", serviceSlot: "7am", createdAt: now,
};
const child = {
  id: 30, familyId: 3, firstName: "Child", lastName: "One",
  currentClassId: 20, createdAt: now,
};
const changeRequest = {
  id: 40, childId: 30, currentClassId: 20, requestedClassId: 21,
  requestedBy: 1, reason: null, status: "pending", adminNotes: null,
  reviewedBy: null, createdAt: now, updatedAt: now,
};
const message = {
  id: 50, senderId: 1, recipientId: 2, childId: null, subject: "Hello",
  body: "Message body", isRead: false, createdAt: now,
};
const enrichmentError = () => new Error("injected required enrichment failure");

let app: express.Express;

beforeAll(async () => {
  const [{ default: emergencies }, { default: classes }, { default: changes }, { default: messages }] =
    await Promise.all([
      import("../routes/emergencies"),
      import("../routes/classes"),
      import("../routes/classChangeRequests"),
      import("../routes/messages"),
    ]);
  app = express();
  app.use(express.json());
  app.use(emergencies, classes, changes, messages);
});

beforeEach(() => {
  state.outsideSelect.length = 0;
  state.txSelect.length = 0;
  state.outsideMutation.length = 0;
  state.txMutation.length = 0;
  state.committedMutations = 0;
  state.warning.mockReset();
  state.notification.mockReset().mockResolvedValue(undefined);
  state.push.mockReset();
});

type RouteCase = {
  name: string;
  method: "post" | "put";
  path: string;
  body?: Record<string, unknown>;
  arrangeFailure: () => void;
  arrangeSuccess: () => void;
  expectedStatus: number;
  assertResponse: (body: any) => void;
};

const classBody = {
  name: "Class 7", ageMin: 1, ageMax: 2, capacity: 20,
  roomLocation: "Room A", serviceSlot: "7am",
};

const cases: RouteCase[] = [
  {
    name: "POST /emergencies", method: "post", path: "/emergencies",
    body: { type: "medical", level: "L1", description: "Incident" },
    arrangeFailure: () => {
      state.txMutation.push([emergency], []);
      state.txSelect.push(enrichmentError());
    },
    arrangeSuccess: () => {
      state.txMutation.push([emergency], []);
      state.txSelect.push([user]);
    },
    expectedStatus: 201,
    assertResponse: body => expect(body).toMatchObject({ id: 10, child: null, triggeredByUser: { id: 1 } }),
  },
  {
    name: "PUT /emergencies/:id", method: "put", path: "/emergencies/10",
    body: { status: "monitoring" },
    arrangeFailure: () => {
      state.txMutation.push([{ ...emergency, status: "monitoring" }]);
      state.txSelect.push(enrichmentError());
    },
    arrangeSuccess: () => {
      state.txMutation.push([{ ...emergency, status: "monitoring" }]);
      state.txSelect.push([user]);
    },
    expectedStatus: 200,
    assertResponse: body => expect(body).toMatchObject({ status: "monitoring", triggeredByUser: { id: 1 } }),
  },
  {
    name: "PUT /emergencies/:id/escalate", method: "put", path: "/emergencies/10/escalate",
    body: { newLevel: "L2" },
    arrangeFailure: () => {
      state.txSelect.push([emergency], enrichmentError());
      state.txMutation.push([{ ...emergency, level: "L2" }], []);
    },
    arrangeSuccess: () => {
      state.txSelect.push([emergency], [user]);
      state.txMutation.push([{ ...emergency, level: "L2" }], []);
    },
    expectedStatus: 200,
    assertResponse: body => expect(body).toMatchObject({ level: "L2", triggeredByUser: { id: 1 } }),
  },
  {
    name: "POST /emergencies/:id/update", method: "post", path: "/emergencies/10/update",
    body: { message: "Update" },
    arrangeFailure: () => {
      state.txSelect.push([emergency], enrichmentError());
      state.txMutation.push([emergencyUpdate]);
    },
    arrangeSuccess: () => {
      state.txSelect.push([emergency], [user]);
      state.txMutation.push([emergencyUpdate]);
    },
    expectedStatus: 201,
    assertResponse: body => expect(body).toMatchObject({ id: 11, user: { id: 1 } }),
  },
  {
    name: "POST /emergencies/:id/all-clear", method: "post", path: "/emergencies/10/all-clear",
    body: { notes: "Resolved" },
    arrangeFailure: () => {
      state.txSelect.push([emergency], [], enrichmentError());
      state.txMutation.push([{ ...emergency, status: "resolved", resolvedAt: now }], []);
    },
    arrangeSuccess: () => {
      state.txSelect.push([emergency], [], [user]);
      state.txMutation.push([{ ...emergency, status: "resolved", resolvedAt: now }], []);
    },
    expectedStatus: 200,
    assertResponse: body => expect(body).toMatchObject({ status: "resolved", triggeredByUser: { id: 1 } }),
  },
  {
    name: "POST /classes", method: "post", path: "/classes", body: classBody,
    arrangeFailure: () => {
      state.txMutation.push([cls]);
      state.txSelect.push(enrichmentError(), [{ waitCount: 0 }]);
    },
    arrangeSuccess: () => {
      state.txMutation.push([cls]);
      state.txSelect.push([{ count: 0 }], [{ waitCount: 0 }]);
    },
    expectedStatus: 201,
    assertResponse: body => expect(body).toMatchObject({ id: 20, enrollmentCount: 0, waitlistCount: 0, isAtCapacity: false }),
  },
  {
    name: "PUT /classes/:id", method: "put", path: "/classes/20", body: classBody,
    arrangeFailure: () => {
      state.txMutation.push([cls]);
      state.txSelect.push(enrichmentError(), [{ waitCount: 0 }]);
    },
    arrangeSuccess: () => {
      state.txMutation.push([cls]);
      state.txSelect.push([{ count: 0 }], [{ waitCount: 0 }]);
    },
    expectedStatus: 200,
    assertResponse: body => expect(body).toMatchObject({ id: 20, utilizationPercent: 0, waitlistCount: 0 }),
  },
  {
    name: "POST /class-change-requests", method: "post", path: "/class-change-requests",
    body: { childId: 30, requestedClassId: 21 },
    arrangeFailure: () => {
      state.outsideSelect.push([{ currentClassId: 20 }], []);
      state.txMutation.push([changeRequest]);
      state.txSelect.push(enrichmentError(), [cls], [user]);
    },
    arrangeSuccess: () => {
      state.outsideSelect.push([{ currentClassId: 20 }], []);
      state.txMutation.push([changeRequest]);
      state.txSelect.push([child], [cls, { ...cls, id: 21 }], [user]);
    },
    expectedStatus: 201,
    assertResponse: body => expect(body).toMatchObject({ id: 40, child: { id: 30 }, requestedByUser: { id: 1 } }),
  },
  {
    name: "PUT /class-change-requests/:id/approve", method: "put", path: "/class-change-requests/40/approve",
    body: { adminNotes: "Approved" },
    arrangeFailure: () => {
      state.outsideSelect.push([changeRequest], enrichmentError(), [cls], [user]);
    },
    arrangeSuccess: () => {
      state.outsideSelect.push([changeRequest], [child], [cls, { ...cls, id: 21 }], [user]);
      state.outsideMutation.push([], []);
    },
    expectedStatus: 200,
    assertResponse: body => expect(body).toMatchObject({
      success: true,
      request: { status: "approved", child: { id: 30, currentClassId: 21 }, reviewedBy: 1, adminNotes: "Approved" },
    }),
  },
  {
    name: "PUT /class-change-requests/:id/reject", method: "put", path: "/class-change-requests/40/reject",
    body: { adminNotes: "Rejected" },
    arrangeFailure: () => {
      state.txMutation.push([{ ...changeRequest, status: "rejected" }]);
      state.txSelect.push(enrichmentError(), [cls], [user]);
    },
    arrangeSuccess: () => {
      state.txMutation.push([{ ...changeRequest, status: "rejected", adminNotes: "Rejected", reviewedBy: 1 }]);
      state.txSelect.push([child], [cls, { ...cls, id: 21 }], [user]);
    },
    expectedStatus: 200,
    assertResponse: body => expect(body).toMatchObject({ success: true, request: { status: "rejected", child: { id: 30 } } }),
  },
  {
    name: "POST /messages", method: "post", path: "/messages",
    body: { recipientId: 2, subject: "Hello", body: "Message body" },
    arrangeFailure: () => {
      state.outsideSelect.push([user, recipient]);
      state.txMutation.push([message]);
      state.txSelect.push(enrichmentError());
    },
    arrangeSuccess: () => {
      state.outsideSelect.push([user, recipient]);
      state.txMutation.push([message]);
      state.txSelect.push([user, recipient]);
    },
    expectedStatus: 201,
    assertResponse: body => expect(body).toMatchObject({ id: 50, sender: { id: 1 }, recipient: { id: 2 }, child: null }),
  },
  {
    name: "PUT /messages/:id/read", method: "put", path: "/messages/50/read",
    arrangeFailure: () => {
      state.txMutation.push([{ ...message, isRead: true }]);
      state.txSelect.push(enrichmentError());
    },
    arrangeSuccess: () => {
      state.txMutation.push([{ ...message, isRead: true }]);
      state.txSelect.push([user, recipient]);
    },
    expectedStatus: 200,
    assertResponse: body => expect(body).toMatchObject({ id: 50, isRead: true, sender: { id: 1 }, recipient: { id: 2 } }),
  },
];

describe("owned mutation route commit-outcome fault injection", () => {
  it.each(cases)("$name rolls back or avoids all authoritative writes when enrichment fails", async route => {
    route.arrangeFailure();
    const response = await request(app)[route.method](route.path).send(route.body ?? {});
    expect(response.status).toBe(500);
    expect(state.committedMutations).toBe(0);
  });

  it.each(cases)("$name preserves the enriched success response", async route => {
    route.arrangeSuccess();
    const response = await request(app)[route.method](route.path).send(route.body ?? {});
    expect(response.status).toBe(route.expectedStatus);
    route.assertResponse(response.body);
  });

  it("reports optional message notification and SSE failures without failing the committed response", async () => {
    state.outsideSelect.push([user, recipient]);
    state.txMutation.push([message]);
    state.txSelect.push([user, recipient]);
    state.notification.mockRejectedValueOnce(new Error("notification failed"));
    state.push.mockImplementationOnce(() => { throw new Error("SSE failed"); });

    const response = await request(app).post("/messages").send({
      recipientId: 2, subject: "Hello", body: "Message body",
    });
    await new Promise(resolve => setImmediate(resolve));

    expect(response.status).toBe(201);
    expect(state.committedMutations).toBe(1);
    expect(state.warning).toHaveBeenCalledTimes(2);
  });
});