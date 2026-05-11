import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, pickupDelegatesTable, childrenTable, familiesTable, usersTable, notificationsTable } from "@workspace/db";
import { CreatePickupDelegateBody, VerifyDelegateOtpBody, ListPickupDelegatesQueryParams } from "@workspace/api-zod";
import { authMiddleware } from "../middlewares/auth";

const router = Router();

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

router.get("/pickup-delegates", authMiddleware, async (req, res): Promise<void> => {
  const params = ListPickupDelegatesQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: "Bad request", message: params.error.message }); return; }
  const { childId } = params.data;
  const conditions = childId ? [eq(pickupDelegatesTable.childId, childId)] : [];
  const delegates = await db.select().from(pickupDelegatesTable)
    .where(conditions.length ? and(...conditions) : undefined);
  // Don't expose OTP in list
  res.json(delegates.map(d => ({ ...d, otpCode: undefined })));
});

router.post("/pickup-delegates", authMiddleware, async (req, res): Promise<void> => {
  const parsed = CreatePickupDelegateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const otp = generateOTP();
  const otpExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const [delegate] = await db.insert(pickupDelegatesTable).values({
    ...parsed.data,
    otpCode: otp,
    otpExpiresAt,
    parentApproved: false,
  }).returning();
  // Return with OTP for display to parent
  res.status(201).json(delegate);
});

router.post("/pickup-delegates/verify-otp", async (req, res): Promise<void> => {
  const parsed = VerifyDelegateOtpBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const { childId, otpCode } = parsed.data;
  const [delegate] = await db.select().from(pickupDelegatesTable)
    .where(and(eq(pickupDelegatesTable.childId, childId), eq(pickupDelegatesTable.otpCode, otpCode)));
  if (!delegate) {
    res.json({ valid: false, delegate: null, message: "Invalid OTP" });
    return;
  }
  if (delegate.otpExpiresAt && new Date() > delegate.otpExpiresAt) {
    res.json({ valid: false, delegate: null, message: "OTP expired" });
    return;
  }
  res.json({ valid: true, delegate: { ...delegate, otpCode: undefined }, message: "OTP verified" });
});

router.put("/pickup-delegates/:id/approve", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [delegate] = await db.update(pickupDelegatesTable).set({ parentApproved: true }).where(eq(pickupDelegatesTable.id, id)).returning();
  if (!delegate) { res.status(404).json({ error: "Not found", message: "Delegate not found" }); return; }
  res.json({ ...delegate, otpCode: undefined });
});

router.post("/pickup-delegates/:id/notify-parent", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }

  const [delegate] = await db.select().from(pickupDelegatesTable).where(eq(pickupDelegatesTable.id, id));
  if (!delegate) { res.status(404).json({ error: "Not found", message: "Delegate not found" }); return; }

  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, delegate.childId));
  if (!child) { res.status(404).json({ error: "Not found", message: "Child not found" }); return; }

  let parentUserId: number | null = null;
  if (child.familyId) {
    const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, child.familyId));
    if (family?.parent1Id) parentUserId = family.parent1Id;
  }
  if (!parentUserId) { res.status(404).json({ error: "Not found", message: "Parent not found for this child" }); return; }

  await db.insert(notificationsTable).values({
    userId: parentUserId,
    type: "delegate_pickup_alert",
    title: `📢 Delegate Collecting ${child.firstName}`,
    message: `${delegate.name} has presented a verified OTP to collect ${child.firstName} ${child.lastName}. If this is not authorised, contact the front desk immediately.`,
    channel: "in_app" as const,
    readStatus: false,
    metadataJson: JSON.stringify({ delegateId: id, childId: child.id, delegateName: delegate.name }),
  });

  res.json({ success: true, message: `Parent notified of delegate pickup for ${child.firstName} ${child.lastName}.` });
});

export default router;
