import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { selectMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: selectMock,
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  usersTable: {
    id: "id",
    role: "role",
    status: "status",
    firstName: "firstName",
    lastName: "lastName",
    email: "email",
    createdAt: "createdAt",
  },
  teachersTable: {},
  pool: { connect: vi.fn() },
}));

vi.mock("../lib/privateObjectAccess", () => ({
  bindObjectToResource: vi.fn(),
}));

vi.mock("../services/sms", () => ({
  smsAccountApproved: vi.fn(),
  smsAccountRejected: vi.fn(),
  emailAccountApproved: vi.fn(),
  emailAccountRejected: vi.fn(),
}));

const users = [
  {
    id: 1,
    email: "parent@example.com",
    phone: "08000000001",
    role: "parent",
    firstName: "Parent",
    lastName: "One",
    isActive: true,
    status: "active",
    photoUrl: null,
    dob: null,
    gender: null,
    placeOfWork: null,
    communicationPrefs: null,
    hideContactFromAdmin: false,
    secondaryRoles: "[]",
    pendingRoles: "[]",
    createdAt: new Date(),
    passwordHash: "must-never-leak",
    resetToken: "must-never-leak",
    mfaSecret: "must-never-leak",
  },
  {
    id: 2,
    email: "other@example.com",
    phone: "08000000002",
    role: "teacher",
    firstName: "Other",
    lastName: "User",
    isActive: true,
    status: "active",
    photoUrl: null,
    dob: null,
    gender: null,
    placeOfWork: null,
    communicationPrefs: null,
    hideContactFromAdmin: false,
    secondaryRoles: "[]",
    pendingRoles: "[]",
    createdAt: new Date(),
    passwordHash: "must-never-leak",
    resetToken: "must-never-leak",
    mfaSecret: "must-never-leak",
  },
];

let queryResult = users[0];

function mockUserQueries() {
  selectMock.mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(queryResult ? [queryResult] : []),
    }),
  }));
}

describe("GET /api/users/:id object authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserQueries();
  });

  async function appFor(role: string, userId: number) {
    vi.resetModules();
    vi.doMock("../middlewares/auth", () => ({
      authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        req.user = {
          userId,
          email: `${role}@example.com`,
          role,
          firstName: "Viewer",
          lastName: "User",
        };
        next();
      },
      requireRoles: (...roles: string[]) =>
        (req: express.Request, res: express.Response, next: express.NextFunction) =>
          roles.includes(req.user!.role) ? next() : res.status(403).json({ error: "Forbidden" }),
      auditLog: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
    }));
    const { default: usersRouter } = await import("../routes/users");
    const app = express();
    app.use(express.json());
    app.use("/api", usersRouter);
    return app;
  }

  it("allows self profile and excludes internal security fields", async () => {
    queryResult = users[0];
    const app = await appFor("parent", 1);
    const res = await request(app).get("/api/users/1");
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(users[0].email);
    expect(res.body).not.toHaveProperty("passwordHash");
    expect(res.body).not.toHaveProperty("resetToken");
    expect(res.body).not.toHaveProperty("mfaSecret");
  });

  it.each(["parent", "teacher", "support", "attendant"])(
    "conceals another user's record from %s",
    async (role) => {
      queryResult = users[1];
      const app = await appFor(role, 1);
      const res = await request(app).get("/api/users/2");
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Not found", message: "User not found" });
    },
  );

  it.each(["admin", "super_admin"])("allows %s to retrieve another user", async (role) => {
    queryResult = users[1];
    const app = await appFor(role, 99);
    const res = await request(app).get("/api/users/2");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(2);
  });
});