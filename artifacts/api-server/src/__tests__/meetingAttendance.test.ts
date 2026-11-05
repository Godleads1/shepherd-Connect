import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assertMeetingAccess, isMeetingTeacher, meetingWindow, parseMeetingToken } from "../services/meetingAttendance";
import type { Meeting } from "@workspace/db";

describe("meeting attendance policy", () => {
  it("requires active teacher membership, including a valid secondary role", () => {
    const base = { role: "teacher", secondaryRoles: null, isActive: true, status: "active" };
    expect(isMeetingTeacher(base)).toBe(true);
    expect(isMeetingTeacher({ ...base, role: "parent" })).toBe(false);
    expect(isMeetingTeacher({ ...base, role: "admin", secondaryRoles: '["teacher"]' })).toBe(true);
    expect(isMeetingTeacher({ ...base, role: "admin", secondaryRoles: '{"teacher":true}' })).toBe(false);
    expect(isMeetingTeacher({ ...base, role: "admin", secondaryRoles: 'invalid' })).toBe(false);
    expect(isMeetingTeacher({ ...base, isActive: false })).toBe(false);
    expect(isMeetingTeacher({ ...base, status: "suspended" })).toBe(false);
  });
  it("validates bounded meeting windows", () => {
    expect(meetingWindow("2026-11-10T08:00:00Z", "2026-11-10T10:00:00Z").endsAt.toISOString()).toBe("2026-11-10T10:00:00.000Z");
    for (const end of ["invalid", "2026-11-10T08:00:00Z", "2026-11-10T07:00:00Z", "2026-12-10T08:00:00Z"]) {
      expect(() => meetingWindow("2026-11-10T08:00:00Z", end)).toThrow();
    }
  });
  it("accepts only meeting-shaped opaque tokens", () => {
    expect(parseMeetingToken(`123.${"a".repeat(43)}`)).toBe(123);
    for (const token of ["", "123", `0.${"a".repeat(43)}`, `2147483648.${"a".repeat(43)}`, `123.${"a".repeat(42)}`, "sunday-qr"]) {
      expect(() => parseMeetingToken(token)).toThrow();
    }
  });
  it("checks QR rotation, closure and server window boundaries", () => {
    const token = `1.${"a".repeat(43)}`;
    const meeting: Meeting = {
      id: 1, title: "Meeting", startsAt: new Date("2026-11-10T08:00:00Z"), endsAt: new Date("2026-11-10T10:00:00Z"),
      createdBy: 1, createdAt: new Date(), isOpen: true, tokenHash: createHash("sha256").update(token).digest("hex"),
    };
    expect(() => assertMeetingAccess(meeting, token, meeting.startsAt)).not.toThrow();
    expect(() => assertMeetingAccess(meeting, token, meeting.endsAt)).toThrow();
    expect(() => assertMeetingAccess(meeting, token, new Date("2026-11-10T07:59:59Z"))).toThrow();
    expect(() => assertMeetingAccess({ ...meeting, isOpen: false }, token, meeting.startsAt)).toThrow();
    expect(() => assertMeetingAccess({ ...meeting, tokenHash: null }, token, meeting.startsAt)).toThrow();
    expect(() => assertMeetingAccess(meeting, `1.${"b".repeat(43)}`, meeting.startsAt)).toThrow();
  });
});
