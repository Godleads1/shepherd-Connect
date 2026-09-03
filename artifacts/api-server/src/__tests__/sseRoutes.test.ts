import { EventEmitter } from "node:events";
import type { Request, Response } from "express";
import { describe, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  inserted: vi.fn(),
  redeemed: vi.fn(),
  selectedUser: vi.fn(),
  addConnection: vi.fn(),
  removeConnection: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => conditions,
  eq: (...conditions: unknown[]) => conditions,
  gt: (...conditions: unknown[]) => conditions,
  isNull: (condition: unknown) => condition,
}));
vi.mock("@workspace/db", () => ({
  db: {
    insert: () => ({ values: mocks.inserted }),
    update: () => ({ set: () => ({ where: () => ({ returning: mocks.redeemed }) }) }),
    select: () => ({ from: () => ({ where: mocks.selectedUser }) }),
  },
  sseTicketsTable: {
    ticketHash: "ticket_hash", purpose: "purpose", expiresAt: "expires_at", consumedAt: "consumed_at",
  },
  usersTable: { id: "id", role: "role", secondaryRoles: "secondary_roles", isActive: "is_active", status: "status" },
}));
vi.mock("../middlewares/auth", () => ({
  authMiddleware: (req: Request, res: Response, next: () => void) => {
    if (req.headers.authorization === "Bearer valid") {
      req.user = { userId: 7, email: "user@example.com", role: "attendant", firstName: "Test", lastName: "User" };
      next();
    } else {
      res.status(401).json({ error: "Unauthorized" });
    }
  },
}));
vi.mock("../lib/sse", () => ({
  addConnection: mocks.addConnection,
  removeConnection: mocks.removeConnection,
}));

const activeUser = { id: 7, role: "parent", secondaryRoles: JSON.stringify(["attendant"]), isActive: true, status: "active" };

function response() {
  const res: any = new EventEmitter();
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.cookie = vi.fn().mockReturnValue(res);
  res.clearCookie = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn();
  res.flushHeaders = vi.fn();
  res.write = vi.fn();
  res.end = vi.fn();
  return res as Response;
}

describe("SSE ticket endpoints", async () => {
  const events = await import("../routes/events");
  const router = events.default as any;
  const get = router.stack.find((layer: any) => layer.route?.path === "/events").route.stack[0].handle;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.inserted.mockResolvedValue(undefined);
    mocks.redeemed.mockResolvedValue([]);
    mocks.selectedUser.mockResolvedValue([activeUser]);
  });

  it("requires the path-scoped cookie and ignores bearer-looking query values", async () => {
    const req = { headers: {}, query: { token: "Bearer valid" } } as unknown as Request;
    const res = response();
    await get(req, res);
    expect(mocks.redeemed).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.clearCookie).toHaveBeenCalledWith(events.TICKET_COOKIE, expect.objectContaining({ path: "/api/events" }));
  });

  it("rejects unauthenticated and pre-MFA bearer mint attempts", () => {
    const post = router.stack.find((layer: any) => layer.route?.path === "/events/ticket").route.stack;
    for (const authorization of [undefined, "Bearer pre-mfa"]) {
      const req = { headers: { authorization } } as Request;
      const res = response();
      post[0].handle(req, res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(401);
    }
  });

  it("mints an HttpOnly Strict path-scoped cookie and persists only a SHA-256 hash", async () => {
    const post = router.stack.find((layer: any) => layer.route?.path === "/events/ticket").route.stack;
    const req = { headers: { authorization: "Bearer valid" }, secure: false } as Request;
    const res = response();
    await new Promise<void>((resolve) => post[0].handle(req, res, () => resolve()));
    await post[1].handle(req, res);
    const stored = mocks.inserted.mock.calls[0][0];
    expect(stored.ticketHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.ticketHash).not.toContain("=");
    expect(stored.selectedRole).toBe("attendant");
    expect(res.cookie).toHaveBeenCalledWith(events.TICKET_COOKIE, expect.any(String), expect.objectContaining({
      httpOnly: true, sameSite: "strict", path: "/api/events", maxAge: 30_000, secure: false,
    }));
  });

  it.each(["expired", "consumed", "wrong-purpose"])("rejects a %s ticket before opening a stream", async () => {
    const req = { headers: { cookie: `${events.TICKET_COOKIE}=ticket` } } as Request;
    const res = response();
    await get(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mocks.addConnection).not.toHaveBeenCalled();
  });

  it.each([
    ["deleted", []],
    ["inactive", [{ ...activeUser, isActive: false }]],
    ["suspended", [{ ...activeUser, status: "suspended" }]],
    ["rejected", [{ ...activeUser, status: "rejected" }]],
    ["removed role", [{ ...activeUser, secondaryRoles: "[]" }]],
  ])("rejects redemption for a %s account", async (_label, users) => {
    mocks.redeemed.mockResolvedValue([{ userId: 7, selectedRole: "attendant" }]);
    mocks.selectedUser.mockResolvedValue(users);
    const res = response();
    await get({ headers: { cookie: `${events.TICKET_COOKIE}=ticket` } } as Request, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mocks.addConnection).not.toHaveBeenCalled();
  });

  it("opens exactly one stream for one atomic redemption and removes it on close", async () => {
    mocks.redeemed.mockResolvedValueOnce([{ userId: 7, selectedRole: "attendant" }]).mockResolvedValueOnce([]);
    const req = new EventEmitter() as Request;
    req.headers = { cookie: `${events.TICKET_COOKIE}=ticket` };
    const first = response();
    await get(req, first);
    await get({ headers: { cookie: `${events.TICKET_COOKIE}=ticket` } } as Request, response());
    expect(mocks.addConnection).toHaveBeenCalledTimes(1);
    expect(events.STREAM_MAX_AGE_MS).toBe(5 * 60_000);
    req.emit("close");
    expect(mocks.removeConnection).toHaveBeenCalledTimes(1);
  });
});