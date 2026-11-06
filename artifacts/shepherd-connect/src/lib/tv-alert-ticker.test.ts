import { describe, expect, it } from "vitest";
import {
  buildTickerAlerts,
  tickerPassSeconds,
  tickerRunMs,
  unseenAlertKeys,
  TICKER_PASSES,
} from "./tv-alert-ticker";
import { adjacentVerse, isOutsideChosenRange, verseRangeLabel } from "./bible-navigation";
import { fumsReportUrl } from "./bible-fums";

const checkIn = {
  id: "7",
  childName: "Ada",
  parentName: "Mrs Obi",
  className: "Toddlers",
  requestedServices: "first" as const,
};

describe("classroom TV alert ticker", () => {
  it("puts pickups and check-ins in one scrolling list, pickups first", () => {
    const alerts = buildTickerAlerts([{ id: "12", childName: "Tolu" }], [checkIn]);
    expect(alerts.map(a => a.key)).toEqual(["pickup:12", "checkin:7"]);
    expect(alerts[0].text).toContain("Tolu's parent is here for pickup");
    expect(alerts[1].text).toContain("Ada is coming — checked in by Mrs Obi for the 7am service");
  });

  it("names merged classes and both-service check-ins", () => {
    const [alert] = buildTickerAlerts([], [{ ...checkIn, requestedServices: "both", homeClassName: "Nursery" }]);
    expect(alert.text).toContain("7am & 10:30am services (Nursery merged into Toddlers)");
  });

  it("keeps pickup and check-in ids apart so one can't hide the other", () => {
    const alerts = buildTickerAlerts([{ id: "5", childName: "A" }], [{ ...checkIn, id: "5" }]);
    expect(unseenAlertKeys(new Set(["pickup:5"]), alerts)).toEqual(["checkin:5"]);
  });

  it("only announces alerts the TV hasn't shown yet", () => {
    const alerts = buildTickerAlerts([{ id: "1", childName: "A" }, { id: "2", childName: "B" }], []);
    expect(unseenAlertKeys(new Set(), alerts)).toEqual(["pickup:1", "pickup:2"]);
    expect(unseenAlertKeys(new Set(["pickup:1", "pickup:2"]), alerts)).toEqual([]);
  });

  it("scrolls three passes, longer lists more slowly", () => {
    expect(TICKER_PASSES).toBe(3);
    const short = buildTickerAlerts([{ id: "1", childName: "A" }], []);
    const long = buildTickerAlerts(Array.from({ length: 10 }, (_, i) => ({ id: String(i), childName: `Child ${i}` })), []);
    expect(tickerPassSeconds(short)).toBe(12);
    expect(tickerPassSeconds(long)).toBeGreaterThan(tickerPassSeconds(short));
    expect(tickerRunMs(short)).toBe((12 * 3 + 1) * 1000);
  });
});

describe("Bible remote navigation", () => {
  it("moves within the chapter, beyond the chosen range", () => {
    expect(adjacentVerse([1, 2, 3, 4], 2, 1)).toBe(3);
    expect(adjacentVerse([1, 2, 3, 4], 2, -1)).toBe(1);
    expect(adjacentVerse([1, 2, 3, 4], 4, 1)).toBeNull();
    expect(adjacentVerse([1, 2, 3, 4], 1, -1)).toBeNull();
  });

  it("skips verses a version omits", () => {
    expect(adjacentVerse([10, 11, 13], 11, 1)).toBe(13);
    expect(adjacentVerse([10, 11, 13], 13, -1)).toBe(11);
  });

  it("labels ranges and flags verses outside them", () => {
    expect(verseRangeLabel("John 3", 16, 18)).toBe("John 3:16–18");
    expect(verseRangeLabel("John 3", 16, 16)).toBe("John 3:16");
    expect(isOutsideChosenRange(19, 16, 18)).toBe(true);
    expect(isOutsideChosenRange(17, 16, 18)).toBe(false);
  });

  it("builds the documented Fair Use report URL", () => {
    expect(fumsReportUrl("tok en", "dev", "ses")).toBe("https://fums.api.bible/f3?t=tok%20en&dId=dev&sId=ses");
  });
});
