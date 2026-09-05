import { logger } from "../lib/logger";

export interface PgListenerClient {
  query(sql: string): Promise<unknown>;
  release(): void;
  on(event: "notification" | "error" | "end", handler: (...args: any[]) => void): void;
}

export interface ClassroomDisplayListenerCoordinatorOptions {
  connect: () => Promise<PgListenerClient>;
  reconcile: (classId: number) => Promise<void>;
  pollMs: number;
}

interface RefreshState {
  running: boolean;
  latestGeneration: number;
  deliveredGeneration: number;
  retryAttempt: number;
  timer?: ReturnType<typeof setTimeout>;
}

const REFRESH_RETRY_MS = [250, 1000, 3000, 5000] as const;
const LISTENER_RETRY_CAP_MS = 30_000;

/** Process-local LISTEN/reconciliation owner; PostgreSQL state remains authority. */
export class ClassroomDisplayListenerCoordinator {
  private readonly classes = new Set<number>();
  private readonly refreshes = new Map<number, RefreshState>();
  private listener: PgListenerClient | undefined;
  private startPromise: Promise<void> | undefined;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private retryAttempt = 0;
  private poll: ReturnType<typeof setInterval> | undefined;
  private stopping = false;

  constructor(private readonly options: ClassroomDisplayListenerCoordinatorOptions) {}

  start(): Promise<void> {
    if (this.listener) return Promise.resolve();
    if (this.stopping) return Promise.reject(new Error("Classroom display listener is shutting down"));
    if (this.startPromise) return this.startPromise;
    this.startPromise = (async () => {
      const client = await this.options.connect();
      try {
        await client.query("LISTEN classroom_display_refresh");
      } catch (error) {
        client.release();
        throw error;
      }
      let disconnected = false;
      const reconnect = () => {
        if (disconnected) return;
        disconnected = true;
        if (this.listener === client) this.listener = undefined;
        try { client.release(); } catch {}
        this.scheduleReconnect();
      };
      client.on("notification", (message: { channel: string; payload?: string }) => {
        if (disconnected) return;
        if (message.channel !== "classroom_display_refresh") return;
        const classId = Number(message.payload);
        if (Number.isInteger(classId) && classId > 0) this.request(classId);
      });
      client.on("error", reconnect);
      client.on("end", reconnect);
      this.listener = client;
      this.retryAttempt = 0;
      // NOTIFY is not replayed: reconcile every locally connected class after
      // initial LISTEN and after every reconnect.
      for (const classId of this.classes) this.request(classId);
    })().catch(error => {
      this.scheduleReconnect();
      throw error;
    }).finally(() => { this.startPromise = undefined; });
    return this.startPromise;
  }

  setConnected(classId: number, connected: boolean) {
    if (connected) {
      this.classes.add(classId);
      this.ensurePoll();
    } else {
      this.classes.delete(classId);
      this.clearRefresh(classId);
      if (!this.classes.size && this.poll) {
        clearInterval(this.poll);
        this.poll = undefined;
      }
    }
  }

  isListening(): boolean {
    return Boolean(this.listener);
  }

  request(classId: number) {
    if (!this.classes.has(classId) || this.stopping) return;
    const current = this.refreshes.get(classId);
    if (current) {
      current.latestGeneration += 1;
      if (current.timer) {
        clearTimeout(current.timer);
        current.timer = undefined;
        current.retryAttempt = 0;
        this.run(classId, current);
      }
      return;
    }
    const state: RefreshState = { running: false, latestGeneration: 1, deliveredGeneration: 0, retryAttempt: 0 };
    this.refreshes.set(classId, state);
    this.run(classId, state);
  }

  stop() {
    this.stopping = true;
    if (this.retry) clearTimeout(this.retry);
    if (this.poll) clearInterval(this.poll);
    this.retry = undefined; this.poll = undefined;
    for (const classId of this.refreshes.keys()) this.clearRefresh(classId);
    const active = this.listener;
    this.listener = undefined;
    try { active?.release(); } catch {}
  }

  private ensurePoll() {
    if (this.poll) return;
    this.poll = setInterval(() => {
      for (const classId of this.classes) this.request(classId);
    }, this.options.pollMs);
  }

  private scheduleReconnect() {
    if (this.stopping || this.retry) return;
    const delay = Math.min(1_000 * (2 ** Math.min(this.retryAttempt, 5)), LISTENER_RETRY_CAP_MS);
    this.retryAttempt += 1;
    this.retry = setTimeout(() => {
      this.retry = undefined;
      void this.start().catch(error => logger.warn({ err: error, delay }, "classroom display listener reconnect failed"));
    }, delay);
  }

  private clearRefresh(classId: number) {
    const state = this.refreshes.get(classId);
    if (state?.timer) clearTimeout(state.timer);
    this.refreshes.delete(classId);
  }

  private run(classId: number, state: RefreshState) {
    if (this.refreshes.get(classId) !== state || state.running || state.timer || !this.classes.has(classId) || this.stopping) return;
    state.running = true;
    const generation = state.latestGeneration;
    void this.options.reconcile(classId).then(() => {
      if (this.refreshes.get(classId) !== state) return;
      state.running = false;
      state.deliveredGeneration = generation;
      state.retryAttempt = 0;
      if (state.latestGeneration > generation) this.run(classId, state);
      else this.refreshes.delete(classId);
    }).catch(error => {
      if (this.refreshes.get(classId) !== state) return;
      state.running = false;
      logger.warn({ err: error, classId, attempt: state.retryAttempt }, "classroom display refresh failed");
      if (state.latestGeneration > generation) { state.retryAttempt = 0; this.run(classId, state); return; }
      if (state.retryAttempt >= REFRESH_RETRY_MS.length) { this.refreshes.delete(classId); return; }
      state.timer = setTimeout(() => {
        state.timer = undefined;
        this.run(classId, state);
      }, REFRESH_RETRY_MS[state.retryAttempt++]);
    });
  }
}