/**
 * Small, browser-independent decisions used by AuthProvider. Keeping these
 * pure makes the security boundary regression-testable without a DOM harness.
 */
export type BootstrapDisposition = "clear" | "unknown";
export type RemoteAuthAction = "clear" | "bootstrap" | "ignore";

type StatusError = { status?: unknown };

export function bootstrapDisposition(error: unknown): BootstrapDisposition {
  return (error as StatusError | null)?.status === 401 ? "clear" : "unknown";
}

export function logoutDisposition(error: unknown): "clear" | "retain" {
  return (error as StatusError | null)?.status === 401 ? "clear" : "retain";
}

export function makeAuthSyncSignal(
  type: "login" | "logout" | "revoked" | "session-replaced",
  at = Date.now(),
): string {
  // Intentional allowlist prevents accidental token/secret additions.
  return JSON.stringify({ type, at });
}

export function reconcileRemoteAuth(
  signal: string | null,
  currentToken: string | null,
  sharedToken: string | null,
): RemoteAuthAction {
  if (!signal) return "ignore";
  try {
    const parsed: unknown = JSON.parse(signal);
    if (!parsed || typeof parsed !== "object") return "ignore";
    const type = (parsed as { type?: unknown }).type;
    if (!["login", "logout", "revoked", "session-replaced"].includes(type as string)) return "ignore";
    if (sharedToken !== currentToken) return sharedToken ? "bootstrap" : "clear";
    // A revocation signal is safe to honor even when a browser has not yet
    // observed token storage removal.
    return type === "logout" || type === "revoked" ? "clear" : "ignore";
  } catch {
    return "ignore";
  }
}

export function installReplacementToken(
  response: unknown,
  replaceToken: (token: string) => void,
): void {
  const token = (response as { token?: unknown } | null)?.token;
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("The server did not return a replacement session. Please sign in again.");
  }
  replaceToken(token);
}