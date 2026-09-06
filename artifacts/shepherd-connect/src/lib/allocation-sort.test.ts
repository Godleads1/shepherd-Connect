import { describe, expect, it } from "vitest";
import { sortAllocationsCurrentFirst } from "./allocation-sort";

describe("teacher allocation date order", () => {
  it("puts today first, then upcoming dates, then past dates newest first", () => {
    const rows = [
      { serviceDate: "2026-08-23" },
      { serviceDate: "2026-09-13" },
      { serviceDate: "2026-08-30" },
      { serviceDate: "2026-09-06" },
      { serviceDate: "2026-09-20" },
    ];

    expect(sortAllocationsCurrentFirst(rows, "2026-09-06").map(row => row.serviceDate)).toEqual([
      "2026-09-06",
      "2026-09-13",
      "2026-09-20",
      "2026-08-30",
      "2026-08-23",
    ]);
  });

  it("does not mutate the API response array", () => {
    const rows = [{ serviceDate: "2026-08-30" }, { serviceDate: "2026-09-06" }];
    sortAllocationsCurrentFirst(rows, "2026-09-06");
    expect(rows.map(row => row.serviceDate)).toEqual(["2026-08-30", "2026-09-06"]);
  });
});