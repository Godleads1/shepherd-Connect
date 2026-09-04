import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state = {
    outsideSelectResults: [] as Array<unknown[] | Error>,
    txSelectResults: [] as Array<unknown[] | Error>,
    mutationRecord: {} as Record<string, unknown>,
    mutations: 0,
    commits: 0,
    bindObject: vi.fn(async () => true),
    lockUser: vi.fn(),
  };
  const queryResult = (result: unknown[] | Error) => {
    const resolve = () => result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
    const query: any = {
      limit: vi.fn(resolve),
      orderBy: vi.fn(resolve),
      then: (onFulfilled: (value: unknown[]) => unknown, onRejected: (error: unknown) => unknown) =>
        resolve().then(onFulfilled, onRejected),
    };
    query.where = vi.fn(() => query);
    return query;
  };
  const selectFrom = (queue: Array<unknown[] | Error>) => vi.fn(() => ({
    from: vi.fn(() => queryResult(queue.shift() ?? [])),
  }));
  const returningMutation = () => vi.fn(async () => {
    state.mutations += 1;
    return [state.mutationRecord];
  });
  const transactionClient = () => ({
    select: selectFrom(state.txSelectResults),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: returningMutation() })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => {
        const query: any = {
          where: vi.fn(() => query),
          returning: returningMutation(),
          then: (onFulfilled: (value: unknown) => unknown, onRejected: (error: unknown) => unknown) =>
            Promise.resolve(undefined).then(onFulfilled, onRejected),
        };
        return query;
      }),
    })),
  });
  const db = {
    select: selectFrom(state.outsideSelectResults),
    transaction: vi.fn(async (callback: (tx: ReturnType<typeof transactionClient>) => Promise<unknown>) => {
      const mutationsBefore = state.mutations;
      try {
        const result = await callback(transactionClient());
        state.commits += 1;
        return result;
      } catch (error) {
        state.mutations = mutationsBefore;
        throw error;
      }
    }),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  return Object.assign(state, { db });
});

vi.mock("@workspace/db", async importOriginal => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  return { ...actual, db: mocks.db };
});

vi.mock("../middlewares/auth", () => ({
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = {
      userId: 17,
      email: "admin@example.test",
      role: "super_admin",
      firstName: "Admin",
      lastName: "User",
    };
    next();
  },
  requireRoles: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock("../lib/parentScope", () => ({
  getParentFamilyIds: vi.fn(async () => []),
  parentOwnsChild: vi.fn(async () => true),
  parentOwnsFamily: vi.fn(async () => true),
}));

vi.mock("../lib/privateObjectAccess", () => ({
  assertObjectCanBind: vi.fn(async () => true),
  bindObjectToResource: mocks.bindObject,
}));

vi.mock("../lib/roleMutations", () => ({
  canonicalPendingRoles: vi.fn(() => []),
  canonicalSecondaryRoles: vi.fn(() => []),
  lockUserById: mocks.lockUser,
}));

import childrenRouter from "../routes/children";
import teachersRouter from "../routes/teachers";
import familiesRouter from "../routes/families";

const child = {
  id: 21, familyId: 4, firstName: "Ada", lastName: "Child", dob: "2020-05-01",
  gender: "female", servicePreference: null, allergies: null, medicalNotes: null,
  photoUrl: null, faceDescriptorJson: null, currentClassId: 3, createdAt: new Date(),
};
const user = {
  id: 17, email: "teacher@example.test", phone: null, role: "teacher",
  firstName: "Tee", lastName: "Cher", isActive: true, status: "active",
  secondaryRoles: "[]", pendingRoles: "[]", primaryClassId: 3, createdAt: new Date(),
};
const teacher = { id: 31, userId: 17, createdAt: new Date() };
const family = {
  id: 41, familyCode: "FAM-FAULT", parent1Id: 17, parent2Id: null,
  address: "Lagos", emergencyContactName: null, emergencyContactPhone: null,
  notes: null, isGuest: false, createdAt: new Date(),
};
const enrichmentFailure = () => new Error("injected response enrichment failure");

function appFor(router: express.Router) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.log = { error: vi.fn() } as never;
    next();
  });
  app.use("/api", router);
  return app;
}

async function expectRolledBack(response: request.Response) {
  expect(response.status).toBe(500);
  expect(mocks.mutations).toBe(0);
  expect(mocks.commits).toBe(0);
}

describe("owned mutation route commit boundaries", () => {
  beforeEach(() => {
    mocks.outsideSelectResults.length = 0;
    mocks.txSelectResults.length = 0;
    mocks.mutations = 0;
    mocks.commits = 0;
    mocks.bindObject.mockClear();
    mocks.lockUser.mockReset();
    mocks.db.transaction.mockClear();
  });

  it("rolls back POST /children when required response enrichment fails", async () => {
    mocks.outsideSelectResults.push([{ id: 3, ageMin: 5, ageMax: 5 }]);
    mocks.mutationRecord = child;
    mocks.txSelectResults.push(enrichmentFailure());
    const response = await request(appFor(childrenRouter)).post("/api/children").send({
      familyId: 4, firstName: "Ada", lastName: "Child", dob: "2020-05-01", gender: "female",
    });
    await expectRolledBack(response);
    expect(mocks.bindObject).not.toHaveBeenCalled();
  });

  it("rolls back PUT /children/:id when required response enrichment fails", async () => {
    mocks.outsideSelectResults.push([{ photoUrl: null }], [{ id: 3, ageMin: 5, ageMax: 5 }]);
    mocks.mutationRecord = child;
    mocks.txSelectResults.push(enrichmentFailure());
    const response = await request(appFor(childrenRouter)).put("/api/children/21").send({
      familyId: 4, firstName: "Ada", lastName: "Child", dob: "2020-05-01", gender: "female",
    });
    await expectRolledBack(response);
    expect(mocks.bindObject).not.toHaveBeenCalled();
  });

  it("rolls back PUT /children/:id/face-descriptor when required enrichment fails", async () => {
    mocks.mutationRecord = child;
    mocks.txSelectResults.push(enrichmentFailure());
    const response = await request(appFor(childrenRouter))
      .put("/api/children/21/face-descriptor")
      .send({ descriptorJson: JSON.stringify(Array(128).fill(0.1)), consentGiven: true });
    await expectRolledBack(response);
  });

  it("rolls back POST /teachers when required response enrichment fails", async () => {
    mocks.lockUser.mockResolvedValue(user);
    mocks.mutationRecord = teacher;
    mocks.txSelectResults.push(enrichmentFailure());
    await expectRolledBack(await request(appFor(teachersRouter)).post("/api/teachers").send({ userId: 17 }));
  });

  it("rolls back PUT /teachers/:id when required response enrichment fails", async () => {
    mocks.lockUser.mockResolvedValue(user);
    mocks.mutationRecord = teacher;
    mocks.txSelectResults.push([teacher], enrichmentFailure());
    await expectRolledBack(await request(appFor(teachersRouter)).put("/api/teachers/31").send({ firstName: "New" }));
  });

  it("rolls back POST /families when required response enrichment fails", async () => {
    mocks.mutationRecord = family;
    mocks.txSelectResults.push(enrichmentFailure());
    await expectRolledBack(await request(appFor(familiesRouter)).post("/api/families").send({ parent1Id: 17 }));
  });

  it("rolls back PUT /families/:id when required response enrichment fails", async () => {
    mocks.mutationRecord = family;
    mocks.txSelectResults.push(enrichmentFailure());
    await expectRolledBack(await request(appFor(familiesRouter)).put("/api/families/41").send({ parent1Id: 17 }));
  });

  it.each([
    ["POST", "/api/children", () => {
      mocks.outsideSelectResults.push([{ id: 3, name: "Explorers", ageMin: 5, ageMax: 5 }]);
      mocks.txSelectResults.push([{ id: 3, name: "Explorers", ageMin: 5, ageMax: 5 }], [{ count: 1 }]);
    }],
    ["PUT", "/api/children/21", () => {
      mocks.outsideSelectResults.push([{ photoUrl: null }], [{ id: 3, name: "Explorers", ageMin: 5, ageMax: 5 }]);
      mocks.txSelectResults.push([{ id: 3, name: "Explorers", ageMin: 5, ageMax: 5 }], [{ count: 1 }]);
    }],
    ["PUT", "/api/children/21/face-descriptor", () => {
      mocks.txSelectResults.push([{ id: 3, name: "Explorers", ageMin: 5, ageMax: 5 }], [{ count: 1 }]);
    }],
  ] as const)("preserves child response enrichment fields for %s %s", async (method, path, arrange) => {
    mocks.mutationRecord = child;
    arrange();
    const call = method === "POST" ? request(appFor(childrenRouter)).post(path) : request(appFor(childrenRouter)).put(path);
    const response = path.endsWith("face-descriptor")
      ? await call.send({ descriptorJson: JSON.stringify(Array(128).fill(0.1)), consentGiven: true })
      : await call.send({ familyId: 4, firstName: "Ada", lastName: "Child", dob: "2020-05-01", gender: "female" });
    expect(response.status).toBe(method === "POST" ? 201 : 200);
    expect(response.body).toMatchObject({
      id: 21,
      firstName: "Ada",
      age: expect.any(Number),
      currentClass: { id: 3, name: "Explorers", enrollmentCount: 1 },
    });
    expect(mocks.commits).toBe(1);
  });

  it.each([
    ["POST", "/api/teachers"],
    ["PUT", "/api/teachers/31"],
  ] as const)("preserves teacher response enrichment fields for %s %s", async (method, path) => {
    mocks.lockUser.mockResolvedValue(user);
    mocks.mutationRecord = teacher;
    if (method === "PUT") mocks.txSelectResults.push([teacher]);
    mocks.txSelectResults.push([user], [{ id: 3, name: "Explorers" }]);
    const response = method === "POST"
      ? await request(appFor(teachersRouter)).post(path).send({ userId: 17 })
      : await request(appFor(teachersRouter)).put(path).send({ firstName: "New" });
    expect(response.status).toBe(method === "POST" ? 201 : 200);
    expect(response.body).toMatchObject({
      id: 31,
      user: { id: 17, email: "teacher@example.test", firstName: "Tee" },
      primaryClass: { id: 3, name: "Explorers" },
    });
    expect(mocks.commits).toBe(1);
  });

  it.each([
    ["POST", "/api/families"],
    ["PUT", "/api/families/41"],
  ] as const)("preserves family response enrichment fields for %s %s", async (method, path) => {
    mocks.mutationRecord = family;
    mocks.txSelectResults.push([user], []);
    const response = method === "POST"
      ? await request(appFor(familiesRouter)).post(path).send({ parent1Id: 17 })
      : await request(appFor(familiesRouter)).put(path).send({ parent1Id: 17 });
    expect(response.status).toBe(method === "POST" ? 201 : 200);
    expect(response.body).toMatchObject({
      id: 41,
      familyCode: "FAM-FAULT",
      parent1: { id: 17, email: "teacher@example.test", firstName: "Tee" },
      parent2: null,
      children: [],
    });
    expect(mocks.commits).toBe(1);
  });
});