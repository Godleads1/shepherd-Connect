import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { BufferJSON, initAuthCreds } from "@whiskeysockets/baileys";
import { db } from "@workspace/db";
import {
  clearStoredWhatsAppSession, ensureWhatsAppTables, hasStoredWhatsAppSession, importDiskWhatsAppSession, useDatabaseAuthState,
} from "../services/whatsappAuthStore";
import { acquireOrRenewLease, releaseLease } from "../services/whatsappLeader";

const databaseDescribe = process.env.RUN_DATABASE_ATTENDANCE_TESTS === "true" ? describe : describe.skip;

databaseDescribe("WhatsApp login stored in the database", () => {
  beforeEach(async () => {
    await ensureWhatsAppTables();
    await clearStoredWhatsAppSession();
  });
  afterAll(async () => {
    if (process.env.RUN_DATABASE_ATTENDANCE_TESTS !== "true") return;
    await clearStoredWhatsAppSession();
    await db.execute(sql`DELETE FROM whatsapp_leader_lease`);
  });

  it("survives a 'restart': creds and binary keys round-trip through the database", async () => {
    const first = await useDatabaseAuthState();
    expect(await hasStoredWhatsAppSession()).toBe(false);
    first.state.creds.me = { id: "2348012345678:1@s.whatsapp.net", name: "Church Bot" } as any;
    await first.saveCreds();
    const keyBytes = Buffer.from([1, 2, 3, 250, 251]);
    await first.state.keys.set({ "pre-key": { "7": { public: keyBytes, private: keyBytes } } } as any);

    // A fresh process (new deploy / Autoscale cold start) reads it back.
    const second = await useDatabaseAuthState();
    expect(await hasStoredWhatsAppSession()).toBe(true);
    expect(second.state.creds.me?.id).toBe("2348012345678:1@s.whatsapp.net");
    expect(Buffer.isBuffer(second.state.creds.noiseKey.private)).toBe(true);
    expect(Buffer.from(second.state.creds.noiseKey.private).equals(Buffer.from(first.state.creds.noiseKey.private))).toBe(true);
    const keys = await second.state.keys.get("pre-key", ["7", "8"]);
    expect(Buffer.from((keys["7"] as any).public).equals(keyBytes)).toBe(true);
    expect(keys["8"]).toBeUndefined();

    await second.state.keys.set({ "pre-key": { "7": null } } as any);
    expect((await second.state.keys.get("pre-key", ["7"]))["7"]).toBeUndefined();
  });

  it("imports a session paired before this change, once, without overwriting", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wa-auth-"));
    const creds = initAuthCreds();
    fs.writeFileSync(path.join(dir, "creds.json"), JSON.stringify(creds, BufferJSON.replacer));
    fs.writeFileSync(path.join(dir, "session-2348012345678.0.json"), JSON.stringify({ hello: Buffer.from("x") }, BufferJSON.replacer));
    expect(await importDiskWhatsAppSession(dir)).toBe(2);
    const loaded = await useDatabaseAuthState();
    expect(loaded.state.creds.registrationId).toBe(creds.registrationId);
    expect(await importDiskWhatsAppSession(dir)).toBe(0);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("does nothing when there is no old session on disk", async () => {
    expect(await importDiskWhatsAppSession(path.join(os.tmpdir(), "does-not-exist-wa"))).toBe(0);
    expect(await hasStoredWhatsAppSession()).toBe(false);
  });
});

databaseDescribe("only one instance owns WhatsApp", () => {
  beforeEach(async () => {
    await ensureWhatsAppTables();
    await db.execute(sql`DELETE FROM whatsapp_leader_lease`);
  });

  it("gives the lease to one instance at a time and lets it renew", async () => {
    expect(await acquireOrRenewLease("instance-a")).toBe(true);
    expect(await acquireOrRenewLease("instance-b")).toBe(false);
    expect(await acquireOrRenewLease("instance-a")).toBe(true);
    expect(await acquireOrRenewLease("instance-b")).toBe(false);
  });

  it("hands over immediately when the owner shuts down cleanly", async () => {
    expect(await acquireOrRenewLease("old-deploy")).toBe(true);
    await releaseLease("old-deploy");
    expect(await acquireOrRenewLease("new-deploy")).toBe(true);
  });

  it("lets another instance take over if the owner dies without releasing", async () => {
    expect(await acquireOrRenewLease("crashed", db, 50)).toBe(true);
    expect(await acquireOrRenewLease("survivor")).toBe(false);
    await new Promise(resolve => setTimeout(resolve, 120));
    expect(await acquireOrRenewLease("survivor")).toBe(true);
    expect(await acquireOrRenewLease("crashed")).toBe(false);
  });

  it("never grants the lease to two instances racing for it", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => acquireOrRenewLease(`racer-${i}`)));
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});
