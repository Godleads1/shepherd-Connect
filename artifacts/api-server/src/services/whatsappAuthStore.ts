import fs from "fs";
import path from "path";
import { BufferJSON, initAuthCreds, proto, type AuthenticationCreds, type AuthenticationState, type SignalDataTypeMap } from "@whiskeysockets/baileys";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../lib/logger";

/**
 * Database-backed replacement for Baileys' useMultiFileAuthState.
 *
 * Replit Autoscale does not keep files on disk across restarts and gives each
 * instance its own disk, so the old `.whatsapp-auth` folder kept vanishing and
 * the bot had to be re-paired. Keys use the same names the file store used
 * (minus ".json"), so an existing paired session can be imported unchanged.
 */

type Executor = Pick<typeof db, "execute">;

let tablesReady: Promise<void> | null = null;

/** Schema changes are not auto-applied on deploy, so create these if missing. */
export function ensureWhatsAppTables(executor: Executor = db): Promise<void> {
  if (!tablesReady) {
    tablesReady = (async () => {
      await executor.execute(sql`
        CREATE TABLE IF NOT EXISTS whatsapp_auth_state (
          key text PRIMARY KEY, value text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
        )`);
      await executor.execute(sql`
        CREATE TABLE IF NOT EXISTS whatsapp_leader_lease (
          id integer PRIMARY KEY, holder text NOT NULL, expires_at timestamptz NOT NULL
        )`);
    })().catch(err => { tablesReady = null; throw err; });
  }
  return tablesReady;
}

const keyName = (file: string) => file.replace(/\//g, "__").replace(/:/g, "-");

async function readKeys(keys: string[]): Promise<Map<string, unknown>> {
  if (!keys.length) return new Map();
  const result = await db.execute(sql`
    SELECT key, value FROM whatsapp_auth_state WHERE key IN (${sql.join(keys.map(k => sql`${k}`), sql`, `)})`);
  return new Map((result.rows as Array<{ key: string; value: string }>)
    .map(row => [row.key, JSON.parse(row.value, BufferJSON.reviver)]));
}

async function writeKeys(entries: Array<[string, unknown | null]>): Promise<void> {
  if (!entries.length) return;
  await db.transaction(async tx => {
    for (const [key, value] of entries) {
      if (value === null || value === undefined) {
        await tx.execute(sql`DELETE FROM whatsapp_auth_state WHERE key = ${key}`);
      } else {
        await tx.execute(sql`
          INSERT INTO whatsapp_auth_state (key, value, updated_at)
          VALUES (${key}, ${JSON.stringify(value, BufferJSON.replacer)}, now())
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`);
      }
    }
  });
}

export async function hasStoredWhatsAppSession(): Promise<boolean> {
  await ensureWhatsAppTables();
  const result = await db.execute(sql`SELECT 1 FROM whatsapp_auth_state WHERE key = 'creds' LIMIT 1`);
  return result.rows.length > 0;
}

export async function clearStoredWhatsAppSession(): Promise<void> {
  await ensureWhatsAppTables();
  await db.execute(sql`DELETE FROM whatsapp_auth_state`);
}

/**
 * One-time move of a session paired before this change. Returns the number of
 * keys imported. Never overwrites a session already in the database.
 */
export async function importDiskWhatsAppSession(dir: string): Promise<number> {
  await ensureWhatsAppTables();
  if (await hasStoredWhatsAppSession()) return 0;
  const credsFile = path.join(dir, "creds.json");
  if (!fs.existsSync(credsFile)) return 0;
  const files = fs.readdirSync(dir).filter(name => name.endsWith(".json"));
  const entries: Array<[string, unknown]> = [];
  for (const name of files) {
    try {
      entries.push([name.slice(0, -".json".length), JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"), BufferJSON.reviver)]);
    } catch (err) {
      logger.warn({ file: name, err: String(err) }, "Skipping unreadable WhatsApp session file during import");
    }
  }
  if (!entries.some(([key]) => key === "creds")) return 0;
  await writeKeys(entries);
  logger.info({ keys: entries.length }, "Imported existing WhatsApp session from disk into the database");
  return entries.length;
}

export async function useDatabaseAuthState(): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  await ensureWhatsAppTables();
  const stored = (await readKeys(["creds"])).get("creds") as AuthenticationCreds | undefined;
  const creds: AuthenticationCreds = stored ?? initAuthCreds();
  return {
    state: {
      creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
          const names = ids.map(id => keyName(`${type}-${id}`));
          const found = await readKeys(names);
          const data: { [id: string]: SignalDataTypeMap[T] } = {};
          ids.forEach((id, index) => {
            let value = found.get(names[index]!) as any;
            if (type === "app-state-sync-key" && value) value = proto.Message.AppStateSyncKeyData.fromObject(value);
            data[id] = value;
          });
          return data;
        },
        set: async (data: any) => {
          const entries: Array<[string, unknown | null]> = [];
          for (const category in data) {
            for (const id in data[category]) entries.push([keyName(`${category}-${id}`), data[category][id] ?? null]);
          }
          await writeKeys(entries);
        },
      },
    },
    saveCreds: () => writeKeys([["creds", creds]]),
  };
}
