import { describe, expect, it } from "vitest";
import { familyQrValue, findPendingCustodyEpisode } from "./family-custody-scan";

describe("family custody QR scanning", () => {
  it("encodes the same opaque family code accepted by the API", () => {
    expect(familyQrValue(" fam-a1b2c3 ")).toBe("FAM-A1B2C3");
  });

  it("never falls back to predictable database identifiers", () => {
    expect(familyQrValue("QR:42")).toBeNull();
    expect(familyQrValue("FAM-42")).toBeNull();
    expect(familyQrValue(undefined)).toBeNull();
  });

  it("matches only a requested custody episode for the scanned family and child", () => {
    const episodes = [
      { id: 1, familyId: 7, childId: 11, status: "accepted" },
      { id: 2, familyId: 8, childId: 11, status: "requested" },
      { id: 3, familyId: 7, childId: 12, status: "requested" },
      { id: 4, familyId: 7, childId: 11, status: "requested" },
    ];

    expect(findPendingCustodyEpisode(episodes, 7, 11)).toEqual({ id: 4 });
    expect(findPendingCustodyEpisode(episodes, 7, 99)).toBeNull();
  });
});