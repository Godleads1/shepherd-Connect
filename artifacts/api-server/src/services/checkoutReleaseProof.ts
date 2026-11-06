import { and, eq } from "drizzle-orm";
import { auditLogsTable, childrenTable, familiesTable, pickupDelegatesTable } from "@workspace/db";

/**
 * Server-side release verification for child checkout. A child is released
 * only with proof that the collector is authorised (the parent's family QR or
 * a parent-approved helper code for this child), or through an Admin/Super
 * Admin override with a recorded reason. The client's own screens are never
 * trusted to have done this check.
 */

export type CheckoutReleaseProof = {
  method: "family_qr" | "delegate_otp";
  qrCode?: string;
  otpCode?: string;
};

export type VerifiedRelease =
  | { method: "family_qr" }
  | { method: "delegate_otp"; delegateId: number }
  | { method: "admin_override"; reason: string };

export class CheckoutReleaseError extends Error {
  constructor(public statusCode: number, public errorTitle: string, message: string) {
    super(message);
  }
}

export function familyCodeFromQr(qrCode: string): string | null {
  const normalized = qrCode.trim().toUpperCase();
  return /^FAM-[A-Z0-9]{6}$/.test(normalized) ? normalized : null;
}

export type CheckoutAuthority =
  | { kind: "verify_proof"; proof: CheckoutReleaseProof }
  | { kind: "admin_override"; reason: string }
  /** Nothing to verify because the child has already been released; the
   *  checkout replays as already applied without releasing anyone. */
  | { kind: "already_released" };

/** Decides how a checkout request must be authorised. Throws when the role or
 *  the supplied release method is not allowed. */
export function decideCheckoutAuthority(input: {
  role: string;
  custodyBacked: boolean;
  alreadyReleased: boolean;
  proof?: CheckoutReleaseProof;
  overrideReason?: string;
}): CheckoutAuthority {
  const isAdmin = input.role === "admin" || input.role === "super_admin";
  const reason = input.overrideReason?.trim();
  if (input.custodyBacked && input.role !== "support" && !isAdmin) {
    throw new CheckoutReleaseError(403, "Custody checkout not permitted",
      "Custody-backed children can only be released by Support or by an Admin or Super Admin with a recorded reason.");
  }
  if (reason && !isAdmin) {
    throw new CheckoutReleaseError(403, "Custody override not permitted",
      "Support must verify the parent's QR or an approved helper code. Administrative override reasons may only be submitted by an Admin or Super Admin.");
  }
  if (reason && input.proof) {
    throw new CheckoutReleaseError(400, "Choose one release method",
      "Send either pickup proof or an override reason, not both.");
  }
  if (input.proof) return { kind: "verify_proof", proof: input.proof };
  if (reason) return { kind: "admin_override", reason };
  if (input.alreadyReleased) return { kind: "already_released" };
  if (isAdmin) {
    throw new CheckoutReleaseError(400, "Pickup verification required",
      "Scan the parent's family QR, enter an approved helper code, or enter a reason to record an administrative override.");
  }
  throw new CheckoutReleaseError(400, "Pickup verification required",
    "Scan the parent's family QR or enter an approved helper code before releasing this child.");
}

/** Verifies release proof against the child's family and approved helpers. */
export async function verifyReleaseProof(
  tx: any,
  childId: number,
  proof: CheckoutReleaseProof,
  now: Date = new Date(),
): Promise<VerifiedRelease> {
  if (proof.method === "family_qr") {
    const code = familyCodeFromQr(proof.qrCode ?? "");
    if (!code) {
      throw new CheckoutReleaseError(400, "Pickup not verified", "That is not a family QR code. Scan the parent's family QR.");
    }
    const [match] = await tx.select({ familyCode: familiesTable.familyCode })
      .from(childrenTable)
      .innerJoin(familiesTable, eq(familiesTable.id, childrenTable.familyId))
      .where(eq(childrenTable.id, childId));
    if (!match?.familyCode || match.familyCode.toUpperCase() !== code) {
      throw new CheckoutReleaseError(403, "Pickup not verified",
        "This QR code does not belong to this child's family. Do not release the child.");
    }
    return { method: "family_qr" };
  }

  const otpCode = proof.otpCode?.trim() ?? "";
  if (!/^\d{6}$/.test(otpCode)) {
    throw new CheckoutReleaseError(400, "Pickup not verified", "Enter the helper's 6-digit code.");
  }
  const delegates: Array<typeof pickupDelegatesTable.$inferSelect> = await tx.select().from(pickupDelegatesTable)
    .where(and(eq(pickupDelegatesTable.childId, childId), eq(pickupDelegatesTable.otpCode, otpCode)));
  if (!delegates.length) {
    throw new CheckoutReleaseError(403, "Pickup not verified",
      "This helper code is not valid for this child. Do not release the child.");
  }
  const unexpired = delegates.filter(d => !d.otpExpiresAt || now <= d.otpExpiresAt);
  if (!unexpired.length) {
    throw new CheckoutReleaseError(403, "Pickup not verified", "This helper code has expired. Do not release the child.");
  }
  const approved = unexpired.find(d => d.approvalStatus !== "denied" && (d.parentApproved || d.approvalStatus === "approved"));
  if (!approved) {
    const denied = unexpired.every(d => d.approvalStatus === "denied");
    throw new CheckoutReleaseError(403, "Pickup not verified", denied
      ? "The parent denied this helper. Do not release the child."
      : "The parent has not approved this helper yet.");
  }
  return { method: "delegate_otp", delegateId: approved.id };
}

/** Records, in the same transaction as the release, how it was authorised.
 *  Never stores the QR or helper code itself. */
export async function recordChildRelease(tx: any, input: {
  actorUserId: number;
  childId: number;
  attendanceId?: number | null;
  custodyEpisodeId?: number | null;
  operationId?: string;
  release: VerifiedRelease;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const { release } = input;
  await tx.insert(auditLogsTable).values({
    userId: input.actorUserId,
    action: "child_released",
    entityType: input.attendanceId ? "attendance" : "custody_episode",
    entityId: input.attendanceId ?? input.custodyEpisodeId ?? null,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    metadataJson: JSON.stringify({
      ...(input.operationId ? { operationId: input.operationId } : {}),
      childId: input.childId,
      custodyEpisodeId: input.custodyEpisodeId ?? null,
      method: release.method,
      ...(release.method === "delegate_otp" ? { delegateId: release.delegateId } : {}),
      ...(release.method === "admin_override" ? { overrideReason: release.reason } : {}),
    }),
  });
}
