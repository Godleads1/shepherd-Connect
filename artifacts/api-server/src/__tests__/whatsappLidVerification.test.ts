import { describe, expect, it } from "vitest";
import { checkLidChallenge, issueLidChallenge, LID_CODE_TTL_MS, LID_MAX_ATTEMPTS } from "../services/whatsappLidVerification";

const KEY = "test-key-0123456789";
const JID = "12345@lid";

describe("WhatsApp LID binding requires a code delivered to the real number", () => {
  it("accepts the delivered code for the same LID and candidates", () => {
    const { code, challenge } = issueLidChallenge(KEY, JID, [7, 9], 1_000);
    expect(code).toMatch(/^\d{6}$/);
    expect(JSON.stringify(challenge)).not.toContain(code);
    expect(checkLidChallenge(KEY, JID, challenge, ` ${code} `, 2_000)).toEqual({ ok: true, candidateIds: [7, 9] });
  });

  it("rejects a typed phone number or wrong code", () => {
    const { code, challenge } = issueLidChallenge(KEY, JID, [7], 1_000);
    const wrong = code === "000000" ? "111111" : "000000";
    expect(checkLidChallenge(KEY, JID, challenge, wrong, 2_000)).toMatchObject({ ok: false, reason: "mismatch" });
    expect(checkLidChallenge(KEY, JID, challenge, "08012345678", 2_000)).toMatchObject({ ok: false, reason: "mismatch" });
  });

  it("does not let another LID reuse the challenge", () => {
    const { code, challenge } = issueLidChallenge(KEY, JID, [7], 1_000);
    expect(checkLidChallenge(KEY, "999@lid", challenge, code, 2_000)).toMatchObject({ ok: false });
  });

  it("rejects tampered candidates", () => {
    const { code, challenge } = issueLidChallenge(KEY, JID, [7], 1_000);
    expect(checkLidChallenge(KEY, JID, { ...challenge, lidCandidates: "8" }, code, 2_000)).toMatchObject({ ok: false });
  });

  it("expires and locks", () => {
    const { code, challenge } = issueLidChallenge(KEY, JID, [7], 1_000);
    expect(checkLidChallenge(KEY, JID, challenge, code, 1_000 + LID_CODE_TTL_MS + 1)).toMatchObject({ ok: false, reason: "expired" });
    expect(checkLidChallenge(KEY, JID, { ...challenge, lidAttempts: String(LID_MAX_ATTEMPTS) }, code, 2_000))
      .toMatchObject({ ok: false, reason: "locked" });
  });

  it("an unregistered-number session (no challenge) can never verify", () => {
    expect(checkLidChallenge(KEY, JID, { }, "123456", 2_000)).toMatchObject({ ok: false, reason: "expired" });
  });
});
