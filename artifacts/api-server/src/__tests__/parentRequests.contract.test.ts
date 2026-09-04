import { describe, expect, it } from "vitest";
import {
  CreateParentPickupRequestBody,
  CreateParentPickupRequestResponse,
  GetParentRequestParams,
  ListParentRequestsQueryParams,
  ListParentRequestsResponse,
} from "@workspace/api-zod";

describe("parent request center API contract", () => {
  it("accepts only supported aggregate filters", () => {
    expect(ListParentRequestsQueryParams.safeParse({ type: "custody", status: "requested" }).success).toBe(true);
    expect(ListParentRequestsQueryParams.safeParse({ type: "transport" }).success).toBe(false);
  });

  it("requires a positive child id for pickup", () => {
    expect(CreateParentPickupRequestBody.safeParse({ childId: 12 }).success).toBe(true);
    expect(CreateParentPickupRequestBody.safeParse({ childId: 0 }).success).toBe(false);
  });

  it("models idempotent pickup status explicitly", () => {
    const result = {
      success: true,
      duplicate: true,
      status: "requested",
      message: "Pickup signal is already active",
      request: {
        id: "12-123",
        childId: 12,
        childName: "Test Child",
        parentName: "Test Parent",
        classId: 3,
        className: "Class 3",
        requestedAt: new Date().toISOString(),
      },
    };
    expect(CreateParentPickupRequestResponse.safeParse(result).success).toBe(true);
    expect(CreateParentPickupRequestResponse.safeParse({ ...result, status: "en_route" }).success).toBe(false);
  });

  it("validates parent-safe aggregate and detail identifiers", () => {
    expect(GetParentRequestParams.safeParse({ type: "feedback", id: "9" }).success).toBe(true);
    expect(ListParentRequestsResponse.safeParse({
      items: [],
      children: [{ id: 1, firstName: "Ada", lastName: "Parent", checkedIn: false }],
      counts: { custody: 0, pickup: 0, delegate: 0, class_change: 0, concern: 0, feedback: 0 },
      total: 0,
      refreshedAt: new Date().toISOString(),
    }).success).toBe(true);
  });
});