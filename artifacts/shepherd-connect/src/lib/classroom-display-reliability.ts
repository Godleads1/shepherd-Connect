const MAX_RECONNECT_DELAY_MS = 30_000;
const LEGACY_INVALIDATIONS = new Set([
  "media", "media-page", "pickup", "dismissed",
  "checkin-requested", "checkin-accepted", "checkin-cancelled",
]);

export function reconnectDelay(failureCount: number): number {
  const exponent = Math.max(0, Math.min(Math.trunc(failureCount), 30));
  return Math.min(1_000 * (2 ** exponent), MAX_RECONNECT_DELAY_MS);
}

export function isLegacyDisplayInvalidation(type: unknown): boolean {
  return typeof type === "string" && LEGACY_INVALIDATIONS.has(type);
}

export function handleClassroomDisplayMessage<T>(
  data: { type?: unknown } & Record<string, unknown>,
  generation: number,
  handlers: {
    isCurrent: (generation: number) => boolean;
    applyInit: (data: T) => void;
    applyRefresh: (data: T) => void;
    reconcile: () => void;
  },
): void {
  if (!handlers.isCurrent(generation)) return;
  if (data.type === "init") handlers.applyInit(data as T);
  else if (data.type === "refresh") handlers.applyRefresh(data as T);
  else if (isLegacyDisplayInvalidation(data.type)) handlers.reconcile();
}

export class LatestRequest {
  private generation = 0;
  private controller: AbortController | null = null;
  private disposed = false;

  begin(): { generation: number; signal: AbortSignal } {
    this.controller?.abort();
    this.controller = new AbortController();
    this.disposed = false;
    this.generation += 1;
    return { generation: this.generation, signal: this.controller.signal };
  }

  isCurrent(generation: number): boolean {
    return !this.disposed
      && !this.controller?.signal.aborted
      && generation === this.generation;
  }

  dispose() {
    this.disposed = true;
    this.controller?.abort();
  }
}
// ── Display link storage ─────────────────────────────────────────────────────
// TV links never expire; only a revoke or a newly issued link ends them. The
// link is kept in localStorage so it survives the TV browser being closed,
// restarted or powered off. Older screens kept it in sessionStorage, which a
// restart wiped — that is read once and moved across.
type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const DISPLAY_TOKEN_KEY = "classroom-display-token";

export function displayTokenKey(classId: number): string {
  return `${DISPLAY_TOKEN_KEY}-${classId}`;
}

export function loadDisplayToken(
  classId: number,
  urlToken: string | null,
  persistent: KeyValueStore,
  legacy?: KeyValueStore,
): string {
  const key = displayTokenKey(classId);
  const token = urlToken || persistent.getItem(key) || legacy?.getItem(key) || "";
  if (token) saveDisplayToken(classId, token, persistent, legacy);
  return token;
}

export function saveDisplayToken(classId: number, token: string, persistent: KeyValueStore, legacy?: KeyValueStore): void {
  persistent.setItem(displayTokenKey(classId), token);
  legacy?.removeItem(displayTokenKey(classId));
}

export function forgetDisplayToken(classId: number, persistent: KeyValueStore, legacy?: KeyValueStore): void {
  persistent.removeItem(displayTokenKey(classId));
  legacy?.removeItem(displayTokenKey(classId));
}
