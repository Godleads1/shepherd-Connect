/**
 * WhatsApp Bot — Escape Tests
 *
 * Guarantee that typing "0" from ANY multi-step conversation state always
 * resets the session and returns the correct main menu.
 *
 * If this test suite fails, it means someone added or modified a multi-step
 * handler that intercepts "0" before the early-escape block runs.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ── Hoisted mock state ────────────────────────────────────────────────────────
// vi.hoisted runs before imports, so these refs are accessible in vi.mock factories.

const { mockState, dbQueue, resetAll, mockInsertValues, mockCreatePickupRequest } = vi.hoisted(() => {
  const state = { selectCallIdx: 0 };
  const queue: any[][] = [];
  const insertValues = vi.fn();
  const createPickupRequest = vi.fn();

  return {
    mockState: state,
    dbQueue: queue,
    mockInsertValues: insertValues,
    mockCreatePickupRequest: createPickupRequest,
    resetAll() {
      state.selectCallIdx = 0;
      queue.length = 0;
      insertValues.mockReset();
      createPickupRequest.mockReset();
    },
  };
});

// ── Mock @workspace/db ────────────────────────────────────────────────────────

vi.mock("@workspace/db", () => ({
  db: {
    select: (..._fields: any[]) => {
      const data = dbQueue[mockState.selectCallIdx++] ?? [];
      return {
        from: (_t: any) => ({
          where: (..._: any[]) => Promise.resolve(data),
          orderBy: (..._: any[]) => ({
            limit: (n: number) => Promise.resolve(data.slice(0, n)),
            where: (..._: any[]) => Promise.resolve(data),
          }),
          limit: (n: number) => Promise.resolve(data.slice(0, n)),
          leftJoin: (_t: any, _c: any) => ({
            where: (..._: any[]) => Promise.resolve(data),
            leftJoin: (_t: any, _c: any) => ({
              where: (..._: any[]) => Promise.resolve(data),
            }),
          }),
        }),
      };
    },
    insert: (_t: any) => ({
      values: (d: any) => {
        mockInsertValues(d);
        return {
          onConflictDoUpdate: (_o: any) => Promise.resolve([]),
          onConflictDoNothing: () => Promise.resolve([]),
        };
      },
    }),
    delete: (_t: any) => ({
      where: (..._: any[]) => Promise.resolve([]),
    }),
    update: (_t: any) => ({
      set: (_d: any) => ({
        where: (..._: any[]) => ({ returning: () => Promise.resolve([]) }),
      }),
    }),
  },
  pool: { on: vi.fn(), connect: vi.fn(), end: vi.fn() },
}));

// ── Mock @workspace/db/schema ─────────────────────────────────────────────────
// Table objects are only used as drizzle query arguments — the mock db ignores them.

vi.mock("@workspace/db/schema", () => ({
  usersTable:             { id: {}, phone: {}, role: {}, firstName: {}, lastName: {}, isActive: {}, secondaryRoles: {} },
  familiesTable:          {},
  childrenTable:          {},
  attendanceTable:        {},
  pickupDelegatesTable:   {},
  parentConcernsTable:    {},
  classesTable:           {},
  notificationsTable:     {},
  teachersTable:          {},
  teacherAllocationsTable:{},
  substituteRequestsTable:{},
  supportRequestsTable:   {},
  botSessionsTable:       { jid: {}, step: {}, activeUserId: {}, dataJson: {}, expiresAt: {}, updatedAt: {} },
  botLidCacheTable:       {},
  botPendingApprovalsTable:{},
  botPhotoPendingTable:   {},
}));

// ── Mock botAI ────────────────────────────────────────────────────────────────

vi.mock("../services/botAI", () => ({
  classifyIntent:   vi.fn().mockResolvedValue({ intent: "MENU", confidence: 1 }),
  fuzzyClassify:    vi.fn().mockReturnValue(null),
  greetingLine:     vi.fn((name: string) => `Hello ${name}!`),
  startBotScheduler: vi.fn(),
}));

// ── Mock whatsapp service ─────────────────────────────────────────────────────

vi.mock("../services/whatsapp", () => ({
  sendWhatsAppToJid:      vi.fn().mockResolvedValue(undefined),
  sendWhatsAppImageToJid: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../routes/pickupRequests", () => ({
  ParentPickupRequestError: class ParentPickupRequestError extends Error {},
  createParentPickupRequest: mockCreatePickupRequest,
}));

// ── Import under test ─────────────────────────────────────────────────────────

import { handleInboundMessage } from "../services/whatsappBot";

// ── Test fixtures ─────────────────────────────────────────────────────────────

const PARENT_JID  = "2348012345678@s.whatsapp.net";
const TEACHER_JID = "2348087654321@s.whatsapp.net";
const FUTURE_DATE = new Date(Date.now() + 3_600_000);

const parentUser = {
  id: 42, firstName: "Ada", lastName: "Parent",
  role: "parent", phone: "08012345678",
  isActive: true, status: "active", secondaryRoles: null,
};

const teacherUser = {
  id: 43, firstName: "Bob", lastName: "Teacher",
  role: "teacher", phone: "08087654321",
  isActive: true, status: "active", secondaryRoles: null,
};

/**
 * Builds the six-call DB select sequence the bot executes for a
 * non-LID JID with an active session already in place.
 *
 * Call order:
 *  1. getSession  — pendingApprovalRef check (line ~572)
 *  2. findUsersByPhone (line ~627)
 *  3. getSession  — role-select / activeUserId guard (line ~630)
 *  4. getSession  — main session load (line ~661)
 *  5. revalidate session user against sender phone
 *  6. findUserById (line ~681)
 */
function queueSession(step: string, user: typeof parentUser, data: Record<string, string> = {}) {
  const row = { step, activeUserId: user.id, dataJson: JSON.stringify(data), expiresAt: FUTURE_DATE };
  dbQueue.push(
    [row],       // 1 — getSession (pending approval)
    [user],      // 2 — findUsersByPhone
    [row],       // 3 — getSession (role guard)
    [row],       // 4 — getSession (main)
    [user],      // 5 — session user still belongs to sender
    [user],      // 6 — findUserById
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("typing '0' during a multi-step flow always returns to the main menu", () => {
  let replies: string[];
  const reply          = vi.fn(async (msg: string) => { replies.push(msg); });
  const replyWithImage = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    resetAll();
    replies = [];
    reply.mockClear();
    replyWithImage.mockClear();
  });

  it("escapes from concern_select_type (parent)", async () => {
    queueSession("concern_select_type", parentUser);
    await handleInboundMessage(PARENT_JID, "0", null, reply, replyWithImage);

    expect(reply).toHaveBeenCalledOnce();
    // Parent menu landmarks
    expect(replies[0]).toContain("Check attendance status");
    expect(replies[0]).toContain("Get pickup delegate OTP");
    expect(replies[0]).toContain("Request custody handover");
    expect(replies[0]).toContain("Custody handover status");
    expect(replies[0]).toContain("Notification preferences");
    // Session was reset
    expect(mockInsertValues).toHaveBeenCalled();
    const saved = mockInsertValues.mock.calls[0][0];
    expect(saved.step).toBe("idle");
  });

  it("escapes from concern_enter_desc (parent)", async () => {
    queueSession("concern_enter_desc", parentUser, { concernType: "complaint" });
    await handleInboundMessage(PARENT_JID, "0", null, reply, replyWithImage);

    expect(reply).toHaveBeenCalledOnce();
    expect(replies[0]).toContain("Check attendance status");
  });

  it("escapes from request_select_type (parent)", async () => {
    queueSession("request_select_type", parentUser);
    await handleInboundMessage(PARENT_JID, "0", null, reply, replyWithImage);

    expect(reply).toHaveBeenCalledOnce();
    expect(replies[0]).toContain("Request support");
  });

  it("escapes from request_select_child (parent)", async () => {
    queueSession("request_select_child", parentUser, { requestType: "checkin", childList: "10,11" });
    await handleInboundMessage(PARENT_JID, "0", null, reply, replyWithImage);

    expect(reply).toHaveBeenCalledOnce();
    expect(replies[0]).toContain("Check attendance status");
  });

  it("escapes from teacher_sub_reason (teacher) → shows teacher menu", async () => {
    queueSession("teacher_sub_reason", teacherUser, {
      subClassIds: "5", subServiceDate: "2026-08-03", subClassNames: "Teens",
    });
    await handleInboundMessage(TEACHER_JID, "0", null, reply, replyWithImage);

    expect(reply).toHaveBeenCalledOnce();
    // Teacher menu landmarks
    expect(replies[0]).toContain("class roster");
    expect(replies[0]).toContain("Request a substitute");
  });

  it("does NOT escape when session is idle — processes message normally", async () => {
    // idle step → "0" falls through to the global escape handler (shows menu),
    // not the early-escape block. Outcome is the same but for a different reason.
    queueSession("idle", parentUser);
    await handleInboundMessage(PARENT_JID, "0", null, reply, replyWithImage);

    // The global handler at line ~816 sends the menu too.
    expect(reply).toHaveBeenCalledOnce();
    expect(replies[0]).toContain("Check attendance status");
  });
});

describe("multi-step flows still work when a valid option is sent", () => {
  let replies: string[];
  const reply          = vi.fn(async (msg: string) => { replies.push(msg); });
  const replyWithImage = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    resetAll();
    replies = [];
    reply.mockClear();
    replyWithImage.mockClear();
  });

  it("concern_select_type: sending '1' advances to concern_enter_desc", async () => {
    queueSession("concern_select_type", parentUser);
    await handleInboundMessage(PARENT_JID, "1", null, reply, replyWithImage);

    expect(reply).toHaveBeenCalledOnce();
    expect(replies[0]).toContain("Safeguarding Concern");
    expect(replies[0]).toContain("Type your message now");
  });

  it("request_select_type: sending '1' advances to child selection (or creates request)", async () => {
    // No children registered — should reply with "No children registered"
    queueSession("request_select_type", parentUser);
    // Extra call: getParentChildren → familiesTable → no family
    dbQueue.push([]);

    await handleInboundMessage(PARENT_JID, "1", null, reply, replyWithImage);

    expect(reply).toHaveBeenCalledOnce();
    // Either child selector or "no children" message
    const msg = replies[0];
    expect(
      msg.includes("Which child") || msg.includes("No children")
    ).toBe(true);
  });

  it("custody_select_child: rejects a stale child instead of trusting session state", async () => {
    queueSession("custody_select_child", parentUser, { childList: "999" });
    dbQueue.push([]); // getParentChildren: parent no longer owns any family

    await handleInboundMessage(PARENT_JID, "1", null, reply, replyWithImage);

    expect(reply).toHaveBeenCalledWith(expect.stringContaining("no longer available"));
    expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({
      step: "idle",
      activeUserId: parentUser.id,
    }));
  });

  it("pickup_select_child: rejects a stale child instead of trusting session state", async () => {
    queueSession("pickup_select_child", parentUser, { childList: "999" });
    dbQueue.push([]); // parent no longer has a family/child matching session data

    await handleInboundMessage(PARENT_JID, "1", null, reply, replyWithImage);

    expect(reply).toHaveBeenCalledWith(expect.stringContaining("no longer available"));
    expect(mockCreatePickupRequest).not.toHaveBeenCalled();
  });

  it("pickup_select_child: reports a durable duplicate without resending a signal", async () => {
    queueSession("pickup_select_child", parentUser, { childList: "10" });
    dbQueue.push(
      [{ id: 7 }], // parent family lookup
      [{ id: 10, firstName: "Tobi", lastName: "Child" }], // owned child lookup
    );
    mockCreatePickupRequest.mockResolvedValue({ duplicate: true, childName: "Tobi Child", request: { id: "1" } });

    await handleInboundMessage(PARENT_JID, "1", null, reply, replyWithImage);

    expect(mockCreatePickupRequest).toHaveBeenCalledWith(parentUser.id, 10);
    expect(reply).toHaveBeenCalledWith(expect.stringContaining("already active"));
  });
});

describe("privileged short references never authorize the sender", () => {
  const reply = vi.fn().mockResolvedValue(undefined);
  const replyWithImage = vi.fn().mockResolvedValue(undefined);
  const ref = "SC-REQ-2026-12345";
  const relay = {
    refNumber: ref,
    parentJid: PARENT_JID,
    supportJid: TEACHER_JID,
    childName: "Test Child",
    requestType: "delegate_pickup",
    childId: 10,
    parentUserId: parentUser.id,
    assignedSupportId: teacherUser.id,
  };
  const supportRequest = {
    referenceNumber: ref,
    type: "delegate_pickup",
    childId: 10,
    parentUserId: parentUser.id,
    assignedSupportId: teacherUser.id,
    status: "photo_sent",
  };

  beforeEach(() => {
    resetAll();
    reply.mockClear();
    replyWithImage.mockClear();
  });

  it("rejects APPROVE from a phone that is not the request parent", async () => {
    dbQueue.push(
      [relay],
      [supportRequest],
      [parentUser],
      [teacherUser],
    );

    await handleInboundMessage(TEACHER_JID, `APPROVE ${ref}`, null, reply, replyWithImage);

    expect(reply).toHaveBeenCalledWith(expect.stringContaining("not authorized"));
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("rejects PHOTO when the assigned support account is suspended", async () => {
    dbQueue.push(
      [],
      [{ ...supportRequest, status: "pending" }],
      [{ ...teacherUser, isActive: false, status: "suspended" }],
    );

    await handleInboundMessage(TEACHER_JID, `PHOTO ${ref}`, null, reply, replyWithImage);

    expect(reply).toHaveBeenCalledWith(expect.stringContaining("not the active support officer"));
    expect(mockInsertValues).not.toHaveBeenCalled();
  });
});

describe("sender session revalidation", () => {
  it("discards an activeUserId that no longer belongs to the sender phone", async () => {
    resetAll();
    const staleSession = {
      step: "idle",
      activeUserId: 999,
      dataJson: JSON.stringify({ activeRole: "support" }),
      expiresAt: FUTURE_DATE,
    };
    dbQueue.push(
      [staleSession],
      [parentUser],
      [staleSession],
      [staleSession],
      [parentUser],
      [parentUser],
    );
    const reply = vi.fn().mockResolvedValue(undefined);

    await handleInboundMessage(PARENT_JID, "0", null, reply, vi.fn().mockResolvedValue(undefined));

    expect(reply).toHaveBeenCalledWith(expect.stringContaining("Check attendance status"));
    expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({
      activeUserId: parentUser.id,
      dataJson: "{}",
    }));
  });
});
