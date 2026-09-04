import { describe, expect, it } from "vitest";
import { scopeFamilyEmergencyUpdates, toFamilyEmergencyUpdateDto } from "../lib/familyEmergencyUpdates";

describe("family emergency update privacy DTO", () => {
  it("returns only explicitly approved family fields", () => {
    const source = {
      id: 8,
      emergencyId: 3,
      childId: 5,
      childFirstName: "Ada",
      familyStatus: "Safe and being assessed",
      familyInstructions: "Please wait at reception.",
      publishedAt: new Date("2026-01-02T10:00:00Z"),
      message: "internal staff report text",
      userId: 99,
      publishedBy: 99,
      reporterIdentity: "Staff Member",
      adminNotes: "confidential",
      evidence: ["/objects/private"],
      otherChildId: 77,
    };

    expect(toFamilyEmergencyUpdateDto(source)).toEqual({
      id: 8,
      emergencyId: 3,
      childId: 5,
      childFirstName: "Ada",
      status: "Safe and being assessed",
      instructions: "Please wait at reception.",
      publishedAt: "2026-01-02T10:00:00.000Z",
    });
    expect(Object.keys(toFamilyEmergencyUpdateDto(source))).toEqual([
      "id", "emergencyId", "childId", "childFirstName", "status", "instructions", "publishedAt",
    ]);
  });

  it("excludes updates for children outside the parent's owned child ids", () => {
    const common = {
      emergencyId: 3,
      childFirstName: "Child",
      familyStatus: "Safe",
      familyInstructions: "Wait for instructions",
      publishedAt: new Date("2026-01-02T10:00:00Z"),
    };
    const result = scopeFamilyEmergencyUpdates([
      { ...common, id: 1, childId: 5 },
      { ...common, id: 2, childId: 77 },
    ], [5]);

    expect(result).toHaveLength(1);
    expect(result[0]?.childId).toBe(5);
  });
});