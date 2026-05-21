import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, pickupDelegatesTable, childrenTable, familiesTable, usersTable, notificationsTable } from "@workspace/db";
import { CreatePickupDelegateBody, VerifyDelegateOtpBody, ListPickupDelegatesQueryParams } from "@workspace/api-zod";
import { authMiddleware } from "../middlewares/auth";
import { smsDelegateOtp } from "../services/sms";

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

  // Fetch child name for the SMS message
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, delegate.childId));
  const childName = child ? `${child.firstName} ${child.lastName}` : "your child";

  // Send OTP directly to the delegate's phone via Termii SMS
  await smsDelegateOtp(delegate.phone, delegate.name, childName, otp, req.log);

  // Return with OTP so the parent can also see it in the UI
  res.status(201).json(delegate);
});

router.post("/pickup-delegates/verify-otp", async (req, res): Promise<void> => {
  const parsed = VerifyDelegateOtpBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const { otpCode } = parsed.data;
  const [delegate] = await db.select().from(pickupDelegatesTable)
    .where(eq(pickupDelegatesTable.otpCode, otpCode));
  if (!delegate) {
    res.json({ valid: false, delegate: null, child: null, message: "Invalid OTP" });
    return;
  }
  if (delegate.otpExpiresAt && new Date() > delegate.otpExpiresAt) {
    res.json({ valid: false, delegate: null, child: null, message: "OTP has expired" });
    return;
  }
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, delegate.childId));
  res.json({ valid: true, delegate: { ...delegate, otpCode: undefined }, child: child ?? null, message: "OTP verified" });
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

  await db.update(pickupDelegatesTable)
    .set({ approvalStatus: "pending", approvalRequestedAt: new Date() })
    .where(eq(pickupDelegatesTable.id, id));

  await db.insert(notificationsTable).values({
    userId: parentUserId,
    type: "delegate_approval_request",
    title: `🔔 Approve Pickup: ${child.firstName}`,
    message: `${delegate.name} is at the front desk to collect ${child.firstName} ${child.lastName}. Please approve or deny this pickup request.`,
    channel: "in_app" as const,
    readStatus: false,
    metadataJson: JSON.stringify({ delegateId: id, childId: child.id, delegateName: delegate.name, requiresApproval: true }),
  });

  res.json({ success: true, requiresApproval: true, message: `Parent notified. Waiting for their approval before releasing ${child.firstName}.` });
});

router.post("/pickup-delegates/:id/approve", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }

  const [delegate] = await db.select().from(pickupDelegatesTable).where(eq(pickupDelegatesTable.id, id));
  if (!delegate) { res.status(404).json({ error: "Not found", message: "Delegate not found" }); return; }

  const [updated] = await db.update(pickupDelegatesTable)
    .set({ parentApproved: true, approvalStatus: "approved" })
    .where(eq(pickupDelegatesTable.id, id)).returning();

  res.json({ success: true, delegate: updated, message: "Pickup approved. Child may be released." });
});

router.post("/pickup-delegates/:id/deny", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }

  const [delegate] = await db.select().from(pickupDelegatesTable).where(eq(pickupDelegatesTable.id, id));
  if (!delegate) { res.status(404).json({ error: "Not found", message: "Delegate not found" }); return; }

  const [updated] = await db.update(pickupDelegatesTable)
    .set({ approvalStatus: "denied" })
    .where(eq(pickupDelegatesTable.id, id)).returning();

  res.json({ success: true, delegate: updated, message: "Pickup denied. Front desk has been notified." });
});

export default router;
