/**
 * Retries a DB operation on transient "Control plane" / connection errors.
 * Replit's hosted PostgreSQL occasionally fails to hand out a connection for
 * a brief window — this wrapper auto-recovers instead of surfacing a 500.
 */
export async function withDbRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  baseDelayMs = 800,
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? "";
      const isTransient =
        msg.includes("Control plane") ||
        msg.includes("connection terminated") ||
        msg.includes("Connection terminated") ||
        msg.includes("timeout") ||
        msg.includes("ECONNRESET");

      if (attempt < retries && isTransient) {
        await new Promise(r => setTimeout(r, baseDelayMs * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error("withDbRetry: unreachable");
}
