import { describe, expect, it } from "vitest";
import { AcceptCustodyEpisodeBody, OverrideCustodyPickupBody, RequestCustodyEpisodeBody } from "@workspace/api-zod";

describe("custody handover API contract", () => {
  it("accepts a per-child first, second, or both parent request", () => {
    for (const requestedServices of ["first", "second", "both"]) {
      expect(RequestCustodyEpisodeBody.safeParse({
        childId: 7, serviceDate: "2026-01-04", requestedServices, eventId: `request-${requestedServices}`,
      }).success).toBe(true);
    }
  });

  it("requires an existing episode for physical acceptance", () => {
    expect(AcceptCustodyEpisodeBody.safeParse({ episodeId: 7 }).success).toBe(true);
    expect(AcceptCustodyEpisodeBody.safeParse({
      childId: 7, serviceDate: "2026-01-04", requestedServices: "both",
    }).success).toBe(false);
  });

  it("bounds override reasons", () => {
    expect(OverrideCustodyPickupBody.safeParse({ reason: "Verified safeguarding exception" }).success).toBe(true);
    expect(OverrideCustodyPickupBody.safeParse({ reason: "x".repeat(501) }).success).toBe(false);
  });
});