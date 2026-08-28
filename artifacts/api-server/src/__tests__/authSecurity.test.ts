import type { NextFunction, Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { selectMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: { select: selectMock },
  usersTable: {
    id: "id",
  },
}));

const activeUser = {
  id: 7,
  email: "teacher@example.com",
  role: "teacher",
  firstName: "Current",
  lastName: "Teacher",
  isActive: true,
  status: "active",
  secondaryRoles: JSON.stringify(["support"]),
};

function mockCurrentUser(user: typeof activeUser | null) {
  selectMock.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(user ? [user] : []),
    }),
  });
}

function response() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json } as unknown as Response;
}

describe("authoritative authentication", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SESSION_SECRET = "test-secret-for-vitest";
    mockCurrentUser(activeUser);
  });

  afterEach(() => {
    process.env.SESSION_SECRET = "test-secret-for-vitest";
  });

  it("fails closed when SESSION_SECRET is missing", async () => {
    delete process.env.SESSION_SECRET;
    await expect(import("../middlewares/auth")).rejects.toThrow(/SESSION_SECRET/);
  });

  it("accepts an active user whose selected role is still current", async () => {
    const { authMiddleware, generateToken } = await import("../middlewares/auth");
    const req = {
      headers: {
        authorization: `Bearer ${generateToken({
          userId: activeUser.id,
          email: "stale@example.com",
          role: "teacher",
          firstName: "Stale",
          lastName: "Name",
        })}`,
      },
    } as Request;
    const res = response();
    const next = vi.fn() as NextFunction;

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toMatchObject({
      userId: activeUser.id,
      email: activeUser.email,
      role: "teacher",
      firstName: activeUser.firstName,
      lastName: activeUser.lastName,
    });
  });

  it.each([
    ["a deleted account", null],
    ["an inactive account", { ...activeUser, isActive: false }],
    ["a suspended account", { ...activeUser, status: "suspended" }],
    ["a rejected account", { ...activeUser, status: "rejected" }],
  ])("rejects %s", async (_label, user) => {
    mockCurrentUser(user as typeof activeUser | null);
    const { authMiddleware, generateToken } = await import("../middlewares/auth");
    const req = {
      headers: {
        authorization: `Bearer ${generateToken({
          userId: activeUser.id,
          email: activeUser.email,
          role: "teacher",
          firstName: activeUser.firstName,
          lastName: activeUser.lastName,
        })}`,
      },
    } as Request;
    const res = response();
    const next = vi.fn() as NextFunction;

    await authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("rejects a stale selected role removed from the current account", async () => {
    mockCurrentUser({ ...activeUser, role: "parent", secondaryRoles: "[]" });
    const { authMiddleware, generateToken } = await import("../middlewares/auth");
    const req = {
      headers: {
        authorization: `Bearer ${generateToken({
          userId: activeUser.id,
          email: activeUser.email,
          role: "teacher",
          firstName: activeUser.firstName,
          lastName: activeUser.lastName,
        })}`,
      },
    } as Request;
    const res = response();
    const next = vi.fn() as NextFunction;

    await authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});