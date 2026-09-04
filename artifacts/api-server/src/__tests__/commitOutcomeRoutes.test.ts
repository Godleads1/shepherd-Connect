import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  select: vi.fn(),
  logWarn: vi.fn(),
  commits: 0,
  tx: null as any,
}));

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  return {
    ...actual,
    db: {
      ...actual.db,
      transaction: mocks.transaction,
      select: mocks.select,
    },
  };
});

vi.mock("../middlewares/auth", () => ({
  authMiddleware: (req: any, _res: any, next: () => void) => {
    req.user = { userId: 17, role: "super_admin" };
    next();
  },
  requireRoles: () => (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock("../lib/attendanceNotificationIntents", () => ({
  createAttendanceNotificationIntents: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/sms", () => ({
  emailShepherdsReport: vi.fn().mockResolvedValue(undefined),
  smsChildCheckedIn: vi.fn(),
  smsChildCheckedOut: vi.fn(),
  smsPreDismissal: vi.fn(),
  emailChildCheckedIn: vi.fn(),
  emailChildCheckedOut: vi.fn(),
}));

vi.mock("../services/push", () => ({
  pushToUsers: vi.fn().mockResolvedValue(undefined),
}));

import attendanceRouter from "../routes/attendance";
import safeguardingRouter from "../routes/safeguarding";
import substituteRequestsRouter from "../routes/substituteRequests";
import appraisalsRouter from "../routes/appraisals";

function failingEnrichmentTx(record: Record<string, unknown>) {
  const returning = vi.fn().mockResolvedValue([record]);
  return {
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning })) })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ returning })),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockRejectedValue(new Error("injected response enrichment failure")),
      })),
    })),
  };
}

function appFor(router: express.Router) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.log = {
      warn: mocks.logWarn,
    } as any;
    next();
  });
  app.use("/api", router);
  app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: "injected" });
  });
  return app;
}

beforeEach(() => {
  mocks.commits = 0;
  mocks.transaction.mockReset();
  mocks.select.mockReset();
  mocks.logWarn.mockReset();
  mocks.transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) => {
    const result = await callback(mocks.tx);
    mocks.commits += 1;
    return result;
  });
});

describe("mutation response reads share the authoritative transaction", () => {
  it("rolls back attendance creation when required response enrichment fails", async () => {
    const record = {
      id: 4,
      childId: 2,
      classId: 3,
      serviceDate: "2026-08-23",
      serviceSlot: "7am",
      status: "dropped_off",
    };
    let selectCount = 0;
    mocks.tx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([record]),
        })),
      })),
      select: vi.fn(() => {
        selectCount += 1;
        return {
          from: vi.fn(() => ({
            where: selectCount === 1
              ? vi.fn().mockResolvedValue([])
              : vi.fn().mockRejectedValue(new Error("injected response enrichment failure")),
          })),
        };
      }),
      execute: vi.fn(),
    };

    await request(appFor(attendanceRouter))
      .post("/api/attendance")
      .send({
        childId: 2,
        classId: 3,
        serviceDate: "2026-08-23",
        serviceSlot: "7am",
      })
      .expect(500);

    expect(mocks.tx.insert).toHaveBeenCalledOnce();
    expect(mocks.commits).toBe(0);
  });

  it("returns the authoritative attendance shape and logs optional drop-off resolution failure", async () => {
    const record = {
      id: 4,
      childId: 2,
      classId: 3,
      serviceDate: "2026-08-23",
      serviceSlot: "7am",
      status: "dropped_off",
    };
    const child = { id: 2, familyId: 11, firstName: "Child", lastName: "Name" };
    const cls = { id: 3, name: "Class" };
    let selectCount = 0;
    mocks.tx = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([record]),
        })),
      })),
      select: vi.fn(() => {
        selectCount += 1;
        const rows = selectCount === 1 ? [] : selectCount === 2 ? [child] : [cls];
        return {
          from: vi.fn(() => ({
            where: vi.fn().mockResolvedValue(rows),
          })),
        };
      }),
      execute: vi.fn(),
    };
    mocks.select.mockImplementation(() => {
      throw new Error("injected optional drop-off resolution failure");
    });

    const response = await request(appFor(attendanceRouter))
      .post("/api/attendance")
      .send({
        childId: 2,
        classId: 3,
        serviceDate: "2026-08-23",
        serviceSlot: "7am",
      })
      .expect(201);

    expect(response.body).toMatchObject({
      id: 4,
      child: { id: 2 },
      class: { id: 3 },
    });
    expect(mocks.commits).toBe(1);
    await vi.waitFor(() => expect(mocks.logWarn).toHaveBeenCalledWith(
      expect.objectContaining({ childId: 2, serviceDate: "2026-08-23" }),
      "check-in: could not resolve drop-off intent",
    ));
  });

  it("rolls back attendance escort when required response enrichment fails", async () => {
    mocks.tx = failingEnrichmentTx({
      id: 5,
      childId: 2,
      classId: 3,
      status: "in_transit",
    });

    await request(appFor(attendanceRouter))
      .put("/api/attendance/5/escort")
      .send({})
      .expect(500);

    expect(mocks.tx.update).toHaveBeenCalledOnce();
    expect(mocks.commits).toBe(0);
  });

  it("rolls back attendance arrival when required response enrichment fails", async () => {
    mocks.select.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{
          id: 5,
          childId: 2,
          classId: 3,
          status: "in_transit",
        }]),
      })),
    });
    mocks.tx = failingEnrichmentTx({
      id: 5,
      childId: 2,
      classId: 3,
      status: "in_class",
    });

    await request(appFor(attendanceRouter))
      .put("/api/attendance/5/arrive")
      .send({})
      .expect(500);

    expect(mocks.tx.update).toHaveBeenCalledOnce();
    expect(mocks.commits).toBe(0);
  });

  it("rolls back safeguarding creation when required response enrichment fails", async () => {
    mocks.tx = failingEnrichmentTx({
      id: 6,
      teacherUserId: 8,
      checkType: "DBS",
      status: "clear",
      expiryDate: null,
    });

    await request(appFor(safeguardingRouter))
      .post("/api/safeguarding")
      .send({ teacherUserId: 8, checkType: "DBS", status: "clear" })
      .expect(500);

    expect(mocks.tx.insert).toHaveBeenCalledOnce();
    expect(mocks.commits).toBe(0);
  });

  it("rolls back safeguarding update when required response enrichment fails", async () => {
    mocks.tx = failingEnrichmentTx({
      id: 6,
      teacherUserId: 8,
      checkType: "DBS",
      status: "pending",
      expiryDate: null,
    });

    await request(appFor(safeguardingRouter))
      .put("/api/safeguarding/6")
      .send({ status: "pending" })
      .expect(500);

    expect(mocks.tx.update).toHaveBeenCalledOnce();
    expect(mocks.commits).toBe(0);
  });

  it("rolls back substitute-request creation when required response enrichment fails", async () => {
    mocks.tx = failingEnrichmentTx({
      id: 7,
      requestingTeacherId: 17,
      serviceDate: "2026-08-23",
      reason: "Unavailable",
      classId: null,
      substituteTeacherId: null,
      status: "pending",
    });

    await request(appFor(substituteRequestsRouter))
      .post("/api/substitute-requests")
      .send({ serviceDate: "2026-08-23", reason: "Unavailable" })
      .expect(500);

    expect(mocks.tx.insert).toHaveBeenCalledOnce();
    expect(mocks.commits).toBe(0);
  });

  it("rolls back substitute assignment when required response enrichment fails", async () => {
    mocks.tx = failingEnrichmentTx({
      id: 7,
      requestingTeacherId: 17,
      serviceDate: "2026-08-23",
      reason: "Unavailable",
      classId: null,
      substituteTeacherId: 21,
      status: "assigned",
    });

    await request(appFor(substituteRequestsRouter))
      .put("/api/substitute-requests/7/assign")
      .send({ substituteTeacherId: 21, adminNotes: "Assigned" })
      .expect(500);

    expect(mocks.tx.update).toHaveBeenCalledOnce();
    expect(mocks.commits).toBe(0);
  });

  it("rolls back substitute status update when required response enrichment fails", async () => {
    mocks.tx = failingEnrichmentTx({
      id: 7,
      requestingTeacherId: 17,
      serviceDate: "2026-08-23",
      reason: "Unavailable",
      classId: null,
      substituteTeacherId: null,
      status: "cancelled",
    });

    await request(appFor(substituteRequestsRouter))
      .put("/api/substitute-requests/7/status")
      .send({ status: "cancelled", adminNotes: "No longer needed" })
      .expect(500);

    expect(mocks.tx.update).toHaveBeenCalledOnce();
    expect(mocks.commits).toBe(0);
  });

  it("rolls back appraisal creation when required response enrichment fails", async () => {
    mocks.select.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{ id: 12, userId: 17 }]),
      })),
    });
    mocks.tx = failingEnrichmentTx({
      id: 9,
      childId: 2,
      teacherId: 12,
      serviceDate: "2026-08-23",
    });

    await request(appFor(appraisalsRouter))
      .post("/api/appraisals")
      .send({
        childId: 2,
        serviceDate: "2026-08-23",
        participationLevel: "good",
        scriptureEngagement: "good",
        socialInteraction: "good",
      })
      .expect(500);

    expect(mocks.tx.insert).toHaveBeenCalledOnce();
    expect(mocks.commits).toBe(0);
  });

  it("does not report a committed appraisal failed when optional notification lookup fails", async () => {
    let outsideSelects = 0;
    mocks.select.mockImplementation(() => {
      outsideSelects += 1;
      if (outsideSelects === 1) {
        return {
          from: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([{ id: 12, userId: 17 }]),
          })),
        };
      }
      throw new Error("injected optional notification lookup failure");
    });
    mocks.tx = failingEnrichmentTx({
      id: 10,
      childId: 2,
      teacherId: 12,
      serviceDate: "2026-08-23",
      participationLevel: "good",
      scriptureEngagement: "good",
      socialInteraction: "good",
      milestoneNote: null,
      personalNoteToParent: null,
    });
    mocks.tx.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{ id: 2, firstName: "Child", lastName: "Name" }]),
      })),
    }));

    const response = await request(appFor(appraisalsRouter))
      .post("/api/appraisals")
      .send({
        childId: 2,
        serviceDate: "2026-08-23",
        participationLevel: "good",
        scriptureEngagement: "good",
        socialInteraction: "good",
      })
      .expect(201);

    expect(response.body).toMatchObject({ id: 10, child: { id: 2 } });
    expect(mocks.commits).toBe(1);
    await vi.waitFor(() => expect(mocks.logWarn).toHaveBeenCalledWith(
      expect.objectContaining({ appraisalId: 10 }),
      "appraisal: optional parent notifications failed",
    ));
  });
});