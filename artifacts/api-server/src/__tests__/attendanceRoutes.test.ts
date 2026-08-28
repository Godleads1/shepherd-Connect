import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { attendanceEventsTable, staffScansTable } from "@workspace/db";
import { attendanceEventValidationError, processedEventOutcome, watServiceDateAt } from "../routes/attendance";
import { decideStaffScan } from "../routes/sundayAttendance";

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

describe("Sunday staff scan debounce", () => {
  const now = new Date("2026-08-23T10:00:30.000Z");

  it("treats a checkpoint younger than 30 seconds as a duplicate check-in", () => {
    expect(decideStaffScan([
      { service: "2nd", scanType: "checkpoint", scannedAt: new Date("2026-08-23T10:00:01.000Z") },
    ], "2nd", now)).toBe("duplicate_checkpoint");
  });

  it("allows clock-out once the checkpoint is at least 30 seconds old", () => {
    expect(decideStaffScan([
      { service: "2nd", scanType: "checkpoint", scannedAt: new Date("2026-08-23T10:00:00.000Z") },
    ], "2nd", now)).toBe("clock_out");
  });
});