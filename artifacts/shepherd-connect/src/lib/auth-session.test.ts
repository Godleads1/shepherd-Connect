import { describe, expect, it, vi } from "vitest";
import {
  bootstrapDisposition,
  installReplacementToken,
  logoutDisposition,
  makeAuthSyncSignal,
  reconcileRemoteAuth,
} from "./auth-session";

describe("auth session security decisions", () => {
  it("clears bootstrap only for a proven 401", () => {
    expect(bootstrapDisposition({ status: 401 })).toBe("clear");
    for (const failure of [
      { status: 403 },
      { status: 500 },
      new TypeError("network unavailable"),
      new DOMException("offline", "AbortError"),
      { name: "ResponseParseError", status: 200 },
      new Error("malformed response"),
    ]) {
      expect(bootstrapDisposition(failure)).toBe("unknown");
    }
  });

  it("retains a session after unconfirmed logout failures but clears on logout 401", () => {
    expect(logoutDisposition({ status: 401 })).toBe("clear");
    expect(logoutDisposition({ status: 500 })).toBe("retain");
    expect(logoutDisposition(new TypeError("network unavailable"))).toBe("retain");
  });

  it("uses a non-secret signal and never puts a bearer in broadcast payload", () => {
    const signal = makeAuthSyncSignal("session-replaced", 123);
    expect(JSON.parse(signal)).toEqual({ type: "session-replaced", at: 123 });
    expect(signal.toLowerCase()).not.toContain("token");
    expect(signal.toLowerCase()).not.toContain("bearer");
    expect(signal).not.toContain("eyJ");
  });

  it("clears a peer on logout without rebroadcasting and reboots on token-changing signals", () => {
    const logout = makeAuthSyncSignal("logout", 1);
    expect(reconcileRemoteAuth(logout, "old-token", null)).toBe("clear");
    // Signal handling returns an action only; it never emits another signal,
    // which prevents storage-event loops.
    expect(reconcileRemoteAuth(logout, "same-token", "same-token")).toBe("clear");

    const roleSwitch = makeAuthSyncSignal("login", 2);
    expect(reconcileRemoteAuth(roleSwitch, "teacher-token", "admin-token")).toBe("bootstrap");
    const replacement = makeAuthSyncSignal("session-replaced", 3);
    expect(reconcileRemoteAuth(replacement, "old", "replacement")).toBe("bootstrap");
  });

  it("ignores malformed or unrecognized external signals", () => {
    expect(reconcileRemoteAuth("{not json", "one", "two")).toBe("ignore");
    expect(reconcileRemoteAuth(JSON.stringify({ type: "token", token: "secret" }), "one", "two")).toBe("ignore");
  });

  it("installs each valid replacement token and rejects malformed replacements", () => {
    const replaceToken = vi.fn();
    // This helper is the production path shared by password change, MFA
    // confirmation, and MFA disable consumers.
    installReplacementToken({ token: "password-replacement" }, replaceToken);
    installReplacementToken({ token: "mfa-confirm-replacement" }, replaceToken);
    installReplacementToken({ token: "mfa-disable-replacement" }, replaceToken);
    expect(replaceToken.mock.calls).toEqual([
      ["password-replacement"],
      ["mfa-confirm-replacement"],
      ["mfa-disable-replacement"],
    ]);
    expect(() => installReplacementToken({}, replaceToken)).toThrow("replacement session");
  });
});