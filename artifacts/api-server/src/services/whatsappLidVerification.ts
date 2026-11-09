import { createHmac, randomInt, timingSafeEqual } from "crypto";

/**
 * WhatsApp "LID" senders are opaque: the JID does not reveal the phone number.
 * Typing a phone number is not proof of owning it, so a LID may only be bound
 * to an account after the sender echoes a one-time code that was delivered to
 * that account's real WhatsApp number (its phone JID).
 */

export const LID_CODE_TTL_MS = 10 * 60 * 1000;
export const LID_MAX_ATTEMPTS = 5;
export const LID_MAX_SENDS = 3;

export interface LidChallenge {
  /** HMAC of jid + candidate ids + code; the code itself is never stored. */
  lidCodeDigest: string;
  lidCandidates: string;
  lidCodeExpiresAt: string;
  lidAttempts: string;
}

function digest(key: string, jid: string, candidates: string, code: string): string {
  return createHmac("sha256", key).update(`lid-bind\0${jid}\0${candidates}\0${code}`).digest("hex");
}

export function issueLidChallenge(key: string, jid: string, candidateIds: number[], now = Date.now()) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const candidates = candidateIds.join(",");
  const challenge: LidChallenge = {
    lidCodeDigest: digest(key, jid, candidates, code),
    lidCandidates: candidates,
    lidCodeExpiresAt: String(now + LID_CODE_TTL_MS),
    lidAttempts: "0",
  };
  return { code, challenge };
}

export type LidCheckResult =
  | { ok: true; candidateIds: number[] }
  | { ok: false; reason: "expired" | "locked" | "mismatch"; attempts: number };

export function checkLidChallenge(
  key: string,
  jid: string,
  data: { readonly [K in keyof LidChallenge]?: string | undefined },
  typed: string,
  now = Date.now(),
): LidCheckResult {
  const attempts = Number(data.lidAttempts ?? "0") + 1;
  if (!data.lidCodeDigest || !data.lidCandidates || !data.lidCodeExpiresAt || now > Number(data.lidCodeExpiresAt)) {
    return { ok: false, reason: "expired", attempts };
  }
  if (attempts > LID_MAX_ATTEMPTS) return { ok: false, reason: "locked", attempts };
  const code = typed.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) return { ok: false, reason: "mismatch", attempts };
  const expected = Buffer.from(data.lidCodeDigest, "hex");
  const actual = Buffer.from(digest(key, jid, data.lidCandidates, code), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { ok: false, reason: attempts >= LID_MAX_ATTEMPTS ? "locked" : "mismatch", attempts };
  }
  return { ok: true, candidateIds: data.lidCandidates.split(",").map(Number).filter(Number.isInteger) };
}
