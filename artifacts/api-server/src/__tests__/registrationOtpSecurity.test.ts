import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../../..");
const auth = readFileSync(resolve(root, "artifacts/api-server/src/routes/auth.ts"), "utf8");
const sms = readFileSync(resolve(root, "artifacts/api-server/src/services/sms.ts"), "utf8");
const schema = readFileSync(resolve(root, "lib/db/src/schema/otpSessions.ts"), "utf8");
const spec = readFileSync(resolve(root, "lib/api-spec/openapi.yaml"), "utf8");
const register = readFileSync(resolve(root, "artifacts/shepherd-connect/src/pages/register.tsx"), "utf8");

describe("registration OTP security regression invariants", () => {
  it("uses cryptographic six-digit generation and a versioned domain-separated HMAC", () => {
    expect(auth).toContain("randomInt(100000, 1000000)");
    expect(auth).toContain('"registration-otp"');
    expect(auth).toContain("v1:");
    expect(auth).not.toMatch(/Math\.random\(\).*900000/);
  });

  it("stores attempt and verification state and indexes contact issuance history", () => {
    expect(schema).toContain('attemptCount: integer("attempt_count").notNull().default(0)');
    expect(schema).toContain('verifiedAt: timestamp("verified_at")');
    expect(schema).toContain("index(");
    expect(schema).toContain(".on(table.contact, table.createdAt)");
  });

  it("uses database time, advisory locking, contact controls, and atomic mutations", () => {
    expect(auth).toContain("pg_advisory_xact_lock");
    expect(auth).toContain("interval '60 seconds'");
    expect(auth).toContain("interval '1 hour'");
    expect(auth).toContain("interval '10 minutes'");
    expect(auth).toContain("attempt_count < 5");
    expect(auth).toContain("verified_at IS NULL");
    expect(auth).toContain("DELETE FROM otp_sessions");
    expect(auth).toContain("RETURNING");
    expect(auth).toMatch(/UPDATE otp_sessions SET expires_at = now\(\)\s+WHERE contact = \$\{contact\} AND expires_at > now\(\)/);
    expect(auth).not.toMatch(/UPDATE otp_sessions SET expires_at = now\(\)[\s\S]{0,100}verified_at IS NULL/);
  });

  it("has a dedicated issuance limiter and never sends phone proof to email", () => {
    const registrationOtpRoutes = auth.slice(auth.indexOf('router.post("/auth/send-otp"'), auth.indexOf("// ── MFA endpoints"));
    expect(auth).toContain("otpSendLimiter");
    expect(registrationOtpRoutes).not.toMatch(/phone and email/);
    expect(registrationOtpRoutes).not.toMatch(/email backup/);
  });

  it("requires and forwards otpPinId in the registration contract", () => {
    const registerSchema = spec.slice(spec.indexOf("    RegisterBody:"), spec.indexOf("    RegisterBody:") + 1_500);
    expect(registerSchema).toContain("otpPinId:");
    expect(registerSchema).toMatch(/required:[\s\S]*- otpPinId/);
    expect(register).toMatch(/data:\s*\{[^}]*otpPinId/s);
  });

  it("bounds registration provider calls and reports acceptance", () => {
    expect(sms).toContain("REGISTRATION_PROVIDER_TIMEOUT_MS");
    expect(sms).toMatch(/smsRegistrationOtp[\s\S]*Promise<boolean>/);
    expect(sms).toMatch(/emailRegistrationOtp[\s\S]*Promise<boolean>/);
  });
});