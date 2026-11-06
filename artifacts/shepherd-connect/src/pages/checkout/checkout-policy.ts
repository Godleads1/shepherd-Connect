import type { CheckoutReleaseProof } from "@workspace/api-client-react";

/**
 * Every release needs verified pickup proof (the parent's family QR or an
 * approved helper code). Only an Admin or Super Admin may instead record an
 * override with a reason. The server enforces the same rules.
 */
export type CheckoutAccess =
  | { kind: "verify"; canOverride: boolean }
  | { kind: "blocked"; message: string };

const NORMAL_CHECKOUT_ROLES = new Set(["super_admin", "admin", "support", "attendant"]);
const OVERRIDE_ROLES = new Set(["super_admin", "admin"]);

export function getCheckoutAccess(
  role: string | null | undefined,
  custodyEpisodeId: number | null | undefined,
): CheckoutAccess {
  const canOverride = !!role && OVERRIDE_ROLES.has(role);
  if (!custodyEpisodeId) {
    return role && NORMAL_CHECKOUT_ROLES.has(role)
      ? { kind: "verify", canOverride }
      : {
          kind: "blocked",
          message: "Your role cannot check out children. Ask Support or an administrator for help.",
        };
  }

  if (role === "support" || canOverride) return { kind: "verify", canOverride };

  return {
    kind: "blocked",
    message: "Custody-backed children can only be released by Support or by an Admin or Super Admin with a recorded reason.",
  };
}

const FAMILY_QR_PATTERN = /^FAM-[A-Z0-9]{6}$/;

/** Normalises a scanned or typed family QR; returns null if it is not one. */
export function parseFamilyQr(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  return FAMILY_QR_PATTERN.test(normalized) ? normalized : null;
}

export function familyQrProof(qrCode: string): CheckoutReleaseProof {
  return { method: "family_qr", qrCode };
}

export function helperCodeProof(otpCode: string): CheckoutReleaseProof {
  return { method: "delegate_otp", otpCode: otpCode.trim() };
}

/** Server rejection text without the HTTP status prefix. */
export function checkoutErrorMessage(error: unknown): string {
  const data = (error as { data?: { message?: unknown } } | null)?.data;
  if (typeof data?.message === "string" && data.message) return data.message;
  return error instanceof Error ? error.message : "The checkout was not completed.";
}

export const isVerificationRejection = (error: unknown) => {
  const status = (error as { status?: unknown } | null)?.status;
  return status === 400 || status === 403;
};
