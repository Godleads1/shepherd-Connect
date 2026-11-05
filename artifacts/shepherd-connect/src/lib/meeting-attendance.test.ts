import { describe, expect, it } from "vitest";
import {
  buildMeetingQrUrl, extractMeetingToken, isoToWatInput, validateMeetingForm, watInputToIso, scanErrorCopy,
} from "./meeting-attendance";

const TOKEN = "42." + "aB_c-".repeat(8) + "xyz";

describe("meeting attendance helpers", () => {
  it("converts WAT wall time to explicit +01:00 instants", () => {
    expect(watInputToIso("2025-03-04T18:30")).toBe("2025-03-04T17:30:00.000Z");
    expect(new Date(watInputToIso("2025-03-04T00:15")!).toISOString()).toBe("2025-03-03T23:15:00.000Z");
    expect(watInputToIso("2025-02-30T10:00")).toBeNull();
    expect(watInputToIso("garbage")).toBeNull();
  });

  it("round-trips instants into WAT input values", () => {
    expect(isoToWatInput("2025-03-03T23:15:00.000Z")).toBe("2025-03-04T00:15");
  });

  it("validates title and window", () => {
    expect(validateMeetingForm("", "2025-03-04T18:00", "2025-03-04T19:00")).toMatch(/title/);
    expect(validateMeetingForm("Prep", "2025-03-04T19:00", "2025-03-04T18:00")).toMatch(/after/);
    expect(validateMeetingForm("Prep", "2025-03-04T18:00", "2025-03-04T19:00")).toBeNull();
    expect(validateMeetingForm("Prep", "2025-03-04T18:00", "2025-03-11T18:01")).toMatch(/seven/);
  });

  it("builds fragment URLs and extracts tokens", () => {
    const url = buildMeetingQrUrl("https://x.test", "/app/", TOKEN);
    expect(url).toBe(`https://x.test/app/meeting-attendance#token=${TOKEN}`);
    expect(url).not.toContain("?");
    expect(extractMeetingToken(url)).toBe(TOKEN);
    expect(extractMeetingToken(`#token=${TOKEN}`)).toBe(TOKEN);
    expect(extractMeetingToken(TOKEN)).toBe(TOKEN);
    expect(extractMeetingToken(`https://x.test/other#token=${TOKEN}`)).toBeNull();
    expect(extractMeetingToken("SC-FAMILY-123")).toBeNull();
    expect(extractMeetingToken("0." + "a".repeat(43))).toBeNull();
    expect(extractMeetingToken("2147483648." + "a".repeat(43))).toBeNull();
    expect(extractMeetingToken("42." + "a".repeat(42))).toBeNull();
  });

  it("maps scan errors", () => {
    expect(scanErrorCopy(403, "x").title).toMatch(/not activated/);
    expect(scanErrorCopy(409, "x").title).toMatch(/not accepting/);
    expect(scanErrorCopy(404, "x").title).toMatch(/not valid/);
  });
});
