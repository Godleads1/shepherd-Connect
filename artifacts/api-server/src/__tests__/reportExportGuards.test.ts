import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { auditLogsTable } from "@workspace/db";
import { csv, parseBoundedReportQuery } from "../routes/reports";
import { teacherClockInCsv } from "../routes/teacherClockIns";

describe("report export filter guards", () => {
  it("accepts an ordered 92-day bounded date range and rejects longer or malformed ranges", () => {
    expect(parseBoundedReportQuery({ from: "2026-01-01", to: "2026-04-03", service: "first", format: "csv" })?.service).toBe("first");
    expect(parseBoundedReportQuery({ from: "2026-01-01", to: "2026-04-04" })).toBeNull();
    expect(parseBoundedReportQuery({ from: "2026-02-30" })).toBeNull();
    expect(parseBoundedReportQuery({ from: "2026-05-01", to: "2026-04-01" })).toBeNull();
  });

  it("only accepts explicitly allowlisted report filters and formats", () => {
    expect(parseBoundedReportQuery({ format: "xlsx" })).toBeNull();
    expect(parseBoundedReportQuery({ from: "2026-01-01", emergencyNarrative: "do not log this" })).toBeNull();
    expect(parseBoundedReportQuery({ status: "picked_up", classId: "8" })).toBeNull();
  });
});

describe("CSV and audit privacy guards", () => {
  it("escapes CSV quotes without adding unrequested fields", () => {
    const output = csv([["Child", "Class"], ['A "quoted" name', "Blue"]]);
    expect(output).toContain('"A ""quoted"" name"');
    expect(output).not.toMatch(/allerg|medical/i);
  });

  it("neutralizes spreadsheet formulas, including after whitespace", () => {
    const output = csv([["=SUM(A1:A2)", " +cmd", "-1", "@reference", "ordinary"]]);
    expect(output).toContain(`"'=SUM(A1:A2)"`);
    expect(output).toContain(`"' +cmd"`);
    expect(output).toContain(`"'-1"`);
    expect(output).toContain(`"'@reference"`);
    expect(output).toContain(`"ordinary"`);
  });

  it("neutralizes formulas in teacher clock-in CSV exports", () => {
    const output = teacherClockInCsv([["  =HYPERLINK(\"bad\")", "+cmd", "Safe"]]);
    expect(output).toContain(`"'  =HYPERLINK(""bad"")"`);
    expect(output).toContain(`"'+cmd"`);
    expect(output).toContain(`"Safe"`);
  });

  it("has a dedicated bounded metadata column for report audit evidence", () => {
    const columns = getTableConfig(auditLogsTable).columns.map(column => column.name);
    expect(columns).toContain("metadata_json");
  });
});