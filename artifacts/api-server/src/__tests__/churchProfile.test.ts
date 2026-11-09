import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({ db: { select: () => ({ from: () => ({ where: async () => [] }) }) }, churchSettingsTable: { id: "id" } }));

const ENV_KEYS = ["CHURCH_NAME", "APP_URL", "SERVICE_1_START", "SERVICE_2_START", "SERVICE_1_LABEL", "EMAIL_FROM"];

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  vi.resetModules();
});

describe("church profile", () => {
  it("defaults to the original church when nothing is configured", async () => {
    const { deploymentProfile, serviceStartLabel } = await import("../lib/churchProfile");
    expect(deploymentProfile.churchName).toBe("RCCG City of David");
    expect(deploymentProfile.appUrl).toBe("https://shepherdconnect.intelyticslimited.com");
    expect(serviceStartLabel("7am")).toBe("7:00 AM");
    expect(serviceStartLabel("10:30am")).toBe("10:30 AM");
  });

  it("uses another church's settings from the environment", async () => {
    Object.assign(process.env, {
      CHURCH_NAME: "Grace Chapel Ikeja", APP_URL: "https://grace.example.org/",
      SERVICE_1_START: "08:00", SERVICE_2_START: "11:15", SERVICE_1_LABEL: "Early Service",
    });
    const { deploymentProfile, serviceStartLabel, serviceName, publicChurchProfile } = await import("../lib/churchProfile");
    expect(deploymentProfile.churchName).toBe("Grace Chapel Ikeja");
    expect(deploymentProfile.appUrl).toBe("https://grace.example.org");
    expect(serviceStartLabel("7am")).toBe("8:00 AM");
    expect(serviceStartLabel("10:30am")).toBe("11:15 AM");
    expect(serviceName("7am")).toBe("First Service");
    expect(publicChurchProfile(deploymentProfile)).not.toHaveProperty("emailFrom");
  });

  it("ignores an invalid service time instead of breaking the schedule", async () => {
    process.env.SERVICE_1_START = "25:99";
    const { deploymentProfile } = await import("../lib/churchProfile");
    expect(deploymentProfile.service1Start).toBe("07:00");
  });
});

describe("Sunday schedule from service times", () => {
  it("reproduces the original cron schedule for 07:00 and 10:30", async () => {
    const { buildSundaySchedule } = await import("../lib/scheduler");
    const { checkpoints, clockOutReminders } = buildSundaySchedule("07:00", "10:30");
    expect(checkpoints.map(c => [c.cron, c.label, c.slot])).toEqual([
      ["0 6 * * 0", "7:00 AM", "7am"],
      ["30 7 * * 0", "8:30 AM", "7am"],
      ["30 8 * * 0", "9:30 AM", "7am"],
      ["0 9 * * 0", "10:00 AM", "10:30am"],
      ["0 10 * * 0", "11:00 AM", "10:30am"],
      ["0 11 * * 0", "12:00 PM", "10:30am"],
    ]);
    expect(clockOutReminders.map(r => r.cron)).toEqual(["45 8 * * 0", "15 11 * * 0"]);
  });

  it("moves with another church's times", async () => {
    const { buildSundaySchedule } = await import("../lib/scheduler");
    const { checkpoints, clockOutReminders } = buildSundaySchedule("08:00", "11:15");
    expect(checkpoints[0]).toMatchObject({ cron: "0 7 * * 0", label: "8:00 AM" });
    expect(checkpoints[3]).toMatchObject({ cron: "45 9 * * 0", label: "10:45 AM" });
    expect(clockOutReminders.map(r => r.cron)).toEqual(["45 9 * * 0", "0 12 * * 0"]);
  });
});
