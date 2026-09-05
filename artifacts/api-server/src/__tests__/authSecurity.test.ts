import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
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
  sessionVersion: 1,
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

  it("rejects a token whose server-side session version was revoked", async () => {
    mockCurrentUser({ ...activeUser, sessionVersion: 2 });
    const { authMiddleware, generateToken } = await import("../middlewares/auth");
    const req = {
      headers: {
        authorization: `Bearer ${generateToken({
          userId: activeUser.id,
          email: activeUser.email,
          role: activeUser.role,
          firstName: activeUser.firstName,
          lastName: activeUser.lastName,
          sessionVersion: 1,
        })}`,
      },
    } as Request;
    const res = response();
    const next = vi.fn() as NextFunction;

    await authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("migration-safely treats a legacy full token as session version one", async () => {
    const { authMiddleware } = await import("../middlewares/auth");
    const token = jwt.sign({
      userId: activeUser.id,
      email: activeUser.email,
      role: activeUser.role,
      firstName: activeUser.firstName,
      lastName: activeUser.lastName,
    }, process.env.SESSION_SECRET!, { expiresIn: "5m" });
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const res = response();
    const next = vi.fn() as NextFunction;

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user?.sessionVersion).toBe(1);
  });

  it.each(["parent", "teacher", "support"])(
    "preserves the currently approved %s role in a multi-role account",
    async (selectedRole) => {
      mockCurrentUser({
        ...activeUser,
        role: "parent",
        secondaryRoles: JSON.stringify(["teacher", "support"]),
      });
      const { authMiddleware, generateToken } = await import("../middlewares/auth");
      const req = {
        headers: {
          authorization: `Bearer ${generateToken({
            userId: activeUser.id,
            email: activeUser.email,
            role: selectedRole,
            firstName: activeUser.firstName,
            lastName: activeUser.lastName,
          })}`,
        },
      } as Request;
      const res = response();
      const next = vi.fn() as NextFunction;

      await authMiddleware(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(req.user?.role).toBe(selectedRole);
    },
  );

  it("invalidates only a removed role while remaining approved roles still work", async () => {
    mockCurrentUser({
      ...activeUser,
      role: "parent",
      secondaryRoles: JSON.stringify(["support"]),
    });
    const { authMiddleware, generateToken } = await import("../middlewares/auth");

    async function authenticateAs(role: string) {
      const req = {
        headers: {
          authorization: `Bearer ${generateToken({
            userId: activeUser.id,
            email: activeUser.email,
            role,
            firstName: activeUser.firstName,
            lastName: activeUser.lastName,
          })}`,
        },
      } as Request;
      const res = response();
      const next = vi.fn() as NextFunction;
      await authMiddleware(req, res, next);
      return { res, next };
    }

    const removedTeacher = await authenticateAs("teacher");
    const remainingParent = await authenticateAs("parent");
    const remainingSupport = await authenticateAs("support");

    expect(removedTeacher.next).not.toHaveBeenCalled();
    expect(removedTeacher.res.status).toHaveBeenCalledWith(401);
    expect(remainingParent.next).toHaveBeenCalledOnce();
    expect(remainingSupport.next).toHaveBeenCalledOnce();
  });

  it.each([
    ["the boolean pre-MFA marker", true],
    ["a malformed string pre-MFA marker", "true"],
    ["a malformed numeric pre-MFA marker", 1],
    ["a malformed object pre-MFA marker", {}],
    ["a malformed array pre-MFA marker", []],
  ])("rejects %s in the general verifier used by middleware and SSE", async (_label, mfaOnly) => {
    const { verifyToken } = await import("../middlewares/auth");
    const partialToken = jwt.sign(
      {
        userId: activeUser.id,
        email: activeUser.email,
        role: activeUser.role,
        firstName: activeUser.firstName,
        lastName: activeUser.lastName,
        mfaOnly,
      },
      process.env.SESSION_SECRET!,
      { expiresIn: "5m" },
    );

    expect(verifyToken(partialToken)).toBeNull();
  });

  it("does not treat an opaque SSE ticket as bearer authentication for ordinary APIs", async () => {
    const { authMiddleware } = await import("../middlewares/auth");
    const req = {
      headers: { authorization: `Bearer ${"a".repeat(64)}` },
    } as Request;
    const res = response();
    const next = vi.fn() as NextFunction;

    await authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});