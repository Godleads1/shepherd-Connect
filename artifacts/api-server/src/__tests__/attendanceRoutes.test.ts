import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { attendanceEventsTable, staffScansTable } from "@workspace/db";
import { CheckInBody } from "@workspace/api-zod";
import { attendanceEventValidationError, processedEventOutcome, watServiceDateAt } from "../routes/attendance";
import { decideStaffScan, hashStaffQrToken } from "../routes/sundayAttendance";

describe("attendance event guards", () => {
  const now = new Date("2026-08-23T12:00:00.000Z");

  it("uses West Africa Time for implicit attendance dates", () => {
    expect(watServiceDateAt(new Date("2026-08-22T23:30:00.000Z"))).toBe("2026-08-23");
  });

  it("rejects an event attributed to a different authenticated user", () => {
    expect(attendanceEventValidationError({
      originatingUserId: 9,
      authenticatedUserId: 10,
      originatingRole: "attendant",
      authenticatedRole: "attendant",
      queuedAt: now,
      now,
      serviceDate: "2026-08-23",
    })).toMatch(/originatingUserId/i);
  });

  it("rejects stale and wrong-service-day events", () => {
    expect(attendanceEventValidationError({
      originatingUserId: 10,
      authenticatedUserId: 10,
      originatingRole: "attendant",
      authenticatedRole: "attendant",
      queuedAt: new Date("2026-08-22T11:59:59.999Z"),
      now,
      serviceDate: "2026-08-23",
    })).toMatch(/24 hours/i);
    expect(attendanceEventValidationError({
      originatingUserId: 10,
      authenticatedUserId: 10,
      originatingRole: "attendant",
      authenticatedRole: "attendant",
      queuedAt: now,
      now,
      serviceDate: "2026-08-22",
    })).toMatch(/service date/i);
  });

  it("accepts a current event from the authenticated user", () => {
    expect(attendanceEventValidationError({
      originatingUserId: 10,
      authenticatedUserId: 10,
      originatingRole: "attendant",
      authenticatedRole: "attendant",
      queuedAt: now,
      now,
      serviceDate: "2026-08-23",
    })).toBeNull();
  });

  it("accepts attendant provenance in the queued check-in contract", () => {
    expect(CheckInBody.safeParse({
      childId: 1,
      classId: 2,
      serviceDate: "2026-08-23",
      serviceSlot: "7am",
      eventId: "attendant-event",
      originatingUserId: 10,
      originatingRole: "attendant",
      queuedAt: now.toISOString(),
    }).success).toBe(true);
  });

  it("rejects an event originating from a different active role", () => {
    expect(attendanceEventValidationError({
      originatingUserId: 10,
      authenticatedUserId: 10,
      originatingRole: "admin",
      authenticatedRole: "attendant",
      queuedAt: now,
      now,
      serviceDate: "2026-08-23",
    })).toMatch(/originatingRole/i);
  });

  it("gives a processed event precedence over mutable opposing-slot state", () => {
    const prior = { id: 41, serviceSlot: "7am", status: "picked_up" };
    expect(processedEventOutcome(prior)).toEqual({ kind: "duplicate_event", record: prior });
  });
});

describe("attendance database conflict keys", () => {
  it("deduplicates client events by user, event and operation", () => {
    const unique = getTableConfig(attendanceEventsTable).indexes.find(
      index => index.config.name === "uq_attendance_events_user_event_operation",
    );
    expect(unique?.config.unique).toBe(true);
    expect(unique?.config.columns).toHaveLength(3);
  });

  it("deduplicates staff scans by user, date, service and scan type", () => {
    const unique = getTableConfig(staffScansTable).indexes.find(
      index => index.config.name === "uq_staff_scans_user_date_service_type",
    );
    expect(unique?.config.unique).toBe(true);
    expect(unique?.config.columns).toHaveLength(4);
  });
});

describe("Sunday staff attendance scans", () => {
  it("does not combine or toggle first and second service attendance", () => {
    expect(decideStaffScan([
      { service: "1st", scanType: "checkpoint" },
    ], "2nd", "check_in")).toBe("checkpoint");
  });

  it("idempotently recognizes an already recorded action", () => {
    expect(decideStaffScan([
      { service: "2nd", scanType: "checkpoint" },
    ], "2nd", "check_in")).toBe("already_done");
  });

  it("requires a service check-in before its explicit clock-out", () => {
    expect(decideStaffScan([], "2nd", "clock_out")).toBe("checkpoint_required");
    expect(decideStaffScan([
      { service: "2nd", scanType: "checkpoint" },
    ], "2nd", "clock_out")).toBe("clock_out");
  });

  it("hashes bearer tokens with the attendance-specific domain separator", () => {
    expect(hashStaffQrToken("opaque-token")).not.toBe(hashStaffQrToken("other-token"));
    expect(hashStaffQrToken("opaque-token")).toMatch(/^[a-f0-9]{64}$/);
  });
});