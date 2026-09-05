import { pool } from "@workspace/db";
import { closeUserConnections } from "./sse";
import { logger } from "./logger";

export type SessionInvalidationCoordinator = {
  start(): void;
  stop(): Promise<void>;
  /** Process-local diagnostics for DB integration tests and health checks. */
  state(): { connected: boolean; backendPid?: number };
};
type ListenerClient = {
  on(event: string, listener: (...args: any[]) => void): ListenerClient;
  once(event: string, listener: (...args: any[]) => void): ListenerClient;
  removeAllListeners(event: string): ListenerClient;
  query(text: string): Promise<unknown>;
  release(destroy?: boolean): void;
};
type ListenerPool = { connect(): Promise<ListenerClient> };

export function createSessionInvalidationCoordinator(
  source: ListenerPool,
  close: (userId: number) => void = closeUserConnections,
  retryMs = 250,
): SessionInvalidationCoordinator {
  let running = false;
  let connecting = false;
  let client: ListenerClient | undefined;
  let retry: NodeJS.Timeout | undefined;
  let backendPid: number | undefined;

  const schedule = () => {
    if (!running || retry) return;
    retry = setTimeout(() => { retry = undefined; void connect(); }, retryMs);
    retry.unref();
  };
  const disconnected = (err?: Error) => {
    if (err) logger.warn({ err }, "Session invalidation listener disconnected");
    const old = client;
    client = undefined;
    backendPid = undefined;
    if (old) {
      old.removeAllListeners("notification");
      old.removeAllListeners("error");
      old.removeAllListeners("end");
      old.release(true);
    }
    schedule();
  };
  const connect = async () => {
    if (!running || connecting || client) return;
    connecting = true;
    try {
      const next = await source.connect();
      if (!running) { next.release(); return; }
      client = next;
      next.on("notification", (message: { channel: string; payload?: string }) => {
        if (message.channel !== "session_revocations" || !message.payload) return;
        try {
          const parsed = JSON.parse(message.payload) as { userId?: unknown };
          if (Number.isSafeInteger(parsed.userId) && Number(parsed.userId) > 0) close(Number(parsed.userId));
        } catch { logger.warn("Ignored malformed session invalidation notification"); }
      });
      next.once("error", disconnected);
      next.once("end", () => disconnected());
      await next.query("LISTEN session_revocations");
      const pidResult = await next.query("SELECT pg_backend_pid() AS pid") as { rows?: Array<{ pid: number }> };
      backendPid = pidResult.rows?.[0]?.pid;
    } catch (err) {
      logger.warn({ err }, "Could not connect session invalidation listener");
      disconnected();
    } finally { connecting = false; }
  };

  return {
    state() { return { connected: !!client, backendPid }; },
    start() { if (running) return; running = true; void connect(); },
    async stop() {
      running = false;
      if (retry) { clearTimeout(retry); retry = undefined; }
      const old = client; client = undefined;
      if (old) {
        old.removeAllListeners("notification");
        old.removeAllListeners("error");
        old.removeAllListeners("end");
        try { await old.query("UNLISTEN session_revocations"); } finally { old.release(); }
      }
    },
  };
}

let singleton: SessionInvalidationCoordinator | undefined;
export function startSessionInvalidationListener(): void {
  if (process.env.VITEST || singleton) return;
  singleton = createSessionInvalidationCoordinator(pool as ListenerPool);
  singleton.start();
}

export async function stopSessionInvalidationListenerForTests(): Promise<void> {
  await singleton?.stop();
  singleton = undefined;
}