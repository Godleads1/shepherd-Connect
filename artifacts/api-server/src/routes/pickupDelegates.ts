import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import rateLimit from "express-rate-limit";
import { db, pickupDelegatesTable, childrenTable, familiesTable, usersTable, notificationsTable } from "@workspace/db";
import { CreatePickupDelegateBody, VerifyDelegateOtpBody, ListPickupDelegatesQueryParams } from "@workspace/api-zod";
import { authMiddleware } from "../middlewares/auth";
import { smsDelegateOtp } from "../services/sms";
import { notifyTeachersDelegatePickup } from "../lib/notify";
import { createNotificationDelivery } from "../services/notificationOutbox";
import { getParentChildIds as getOwnedChildIds } from "../lib/parentScope";
import { assertObjectCanBind, bindObjectToResource } from "../lib/privateObjectAccess";

const createDelegateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests", message: "Too many delegate OTPs created. Please try again later." },
  keyGenerator: (req) => req.user?.userId != null ? `user-${req.user.userId}` : "anonymous",
});

const verifyOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests", message: "Too many OTP attempts. Please wait 15 minutes before trying again." },
});

const router = Router();

export const pickupDelegateRouteDependencies = {
  createNotificationDelivery,
  smsDelegateOtp,
};

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendPickupDelegateOtpAfterCommit(
  input: { phone: string | null | undefined; name: string; childNames: string; otp: string; delegateIds: number[] },
  log: { warn(context: unknown, message: string): unknown },
  sendOtp: typeof smsDelegateOtp = pickupDelegateRouteDependencies.smsDelegateOtp,
): Promise<void> {
  try {
    await sendOtp(input.phone, input.name, input.childNames, input.otp, log as any);
  } catch (error) {
    log.warn({ err: error, delegateIds: input.delegateIds }, "Delegate OTP SMS failed after delegate creation committed");
  }
}

/** Returns the set of childIds belonging to the authenticated parent (all owned families), or null if not a parent. */
async function getParentChildIds(userId: number, role: string): Promise<number[] | null> {
  if (role !== "parent") return null;
  return getOwnedChildIds(userId);
}

router.get("/pickup-delegates", authMiddleware, async (req, res): Promise<void> => {
  const params = ListPickupDelegatesQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: "Bad request", message: params.error.message }); return; }
  const { childId } = params.data;

  // Parents can only see delegates for their own children
  const ownChildIds = await getParentChildIds(req.user!.userId, req.user!.role);
  if (ownChildIds !== null) {
    if (childId && !ownChildIds.includes(childId)) {
      res.status(403).json({ error: "Forbidden", message: "Access denied" }); return;
    }
    const filterIds = childId ? [childId] : ownChildIds;
    if (filterIds.length === 0) { res.json([]); return; }
    const delegates = await db.select().from(pickupDelegatesTable)
      .where(inArray(pickupDelegatesTable.childId, filterIds));
    res.json(delegates.map(d => ({ ...d, otpCode: undefined })));
    return;
  }

  // Admin / attendant: normal filter
  const conditions = childId ? [eq(pickupDelegatesTable.childId, childId)] : [];
  const delegates = await db.select().from(pickupDelegatesTable)
    .where(conditions.length ? and(...conditions) : undefined);
  res.json(delegates.map(d => ({ ...d, otpCode: undefined })));
});

router.post("/pickup-delegates", authMiddleware, createDelegateLimiter, async (req, res): Promise<void> => {
  // Classification: delegate rows are AUTHORITATIVE; child/ownership/photo
  // checks are REQUIRED PRE-COMMIT VALIDATION; photo binding retains the
  // existing PARTIAL-MULTI-WRITE COMMAND semantics; OTP SMS is an OPTIONAL
  // SECONDARY EFFECT; returned rows are authoritative RESPONSE ENRICHMENT.
  // Response-loss duplicate risk remains because this create contract has no
  // caller operation id; do not invent idempotency at this route.
  const parsed = CreatePickupDelegateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }

  // Optional multi-child support: body may include `childIds: number[]`.
  // One delegate row is created per child, all sharing a single OTP (one SMS).
  const rawIds = Array.isArray((req.body as any)?.childIds) ? (req.body as any).childIds : null;
  let childIds: number[] = rawIds
    ? [...new Set(rawIds.filter((n: any) => Number.isInteger(n) && n > 0))] as number[]
    : [parsed.data.childId];
  if (childIds.length === 0) childIds = [parsed.data.childId];
  if (childIds.length > 10) {
    res.status(400).json({ error: "Bad request", message: "A delegate can cover at most 10 children at once" });
    return;
  }
  if (!(await assertObjectCanBind(parsed.data.photoUrl, req.user!))) {
    res.status(403).json({ error: "Forbidden", message: "This uploaded photo cannot be attached to this delegate" });
    return;
  }

  // Parents may only create delegates for their own children.
  const ownIds = await getParentChildIds(req.user!.userId, req.user!.role);
  if (ownIds !== null && childIds.some(id => !ownIds.includes(id))) {
    res.status(403).json({ error: "Forbidden", message: "You can only create pickup delegates for your own children" });
    return;
  }

  // Ensure all children exist before inserting anything
  const children = await db.select().from(childrenTable).where(inArray(childrenTable.id, childIds));
  if (children.length !== childIds.length) {
    res.status(400).json({ error: "Bad request", message: "One or more selected children were not found" });
    return;
  }

  const otp = generateOTP();
  const otpExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const { childId: _single, ...delegateFields } = parsed.data;

  const inserted = await db.insert(pickupDelegatesTable).values(childIds.map(cid => ({
    ...delegateFields,
    childId: cid,
    otpCode: otp,
    otpExpiresAt,
    parentApproved: false,
  }))).returning();
  if (
    inserted[0]?.photoUrl
    && !(await bindObjectToResource(inserted[0].photoUrl, "pickup_delegate", inserted[0].id, req.user!))
  ) {
    await db.delete(pickupDelegatesTable).where(inArray(pickupDelegatesTable.id, inserted.map(d => d.id)));
    res.status(403).json({ error: "Forbidden", message: "This uploaded photo cannot be attached to this delegate" });
    return;
  }

  // One SMS listing every child covered by this OTP
  const childNames = children.map(c => `${c.firstName} ${c.lastName}`).join(", ") || "your child";
  await sendPickupDelegateOtpAfterCommit({
    phone: delegateFields.phone,
    name: delegateFields.name,
    childNames,
    otp,
    delegateIds: inserted.map(d => d.id),
  }, req.log);

  // Return the first row with OTP (backwards compatible) plus all covered childIds
  res.status(201).json({ ...inserted[0], childIds: inserted.map(d => d.childId) });
});

router.post("/pickup-delegates/verify-otp", verifyOtpLimiter, async (req, res): Promise<void> => {
  const parsed = VerifyDelegateOtpBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  const { otpCode } = parsed.data;
  // An OTP may cover multiple children (one delegate row per child sharing the code)
  const matches = await db.select().from(pickupDelegatesTable)
    .where(eq(pickupDelegatesTable.otpCode, otpCode));
  const delegate = matches[0];
  if (!delegate) {
    res.json({ valid: false, delegate: null, child: null, message: "Invalid OTP" });
    return;
  }
  if (delegate.otpExpiresAt && new Date() > delegate.otpExpiresAt) {
    res.json({ valid: false, delegate: null, child: null, message: "OTP has expired" });
    return;
  }
  const childIds = matches.map(m => m.childId);
  const children = await db.select().from(childrenTable).where(inArray(childrenTable.id, childIds));
  // `child` stays for backwards compatibility; `children` lists all covered by this OTP
  res.json({
    valid: true,
    delegate: { ...delegate, otpCode: undefined },
    child: children.find(c => c.id === delegate.childId) ?? null,
    children,
    message: "OTP verified",
  });
});

/** Checks if the authenticated parent owns the delegate (i.e. the delegate's child belongs to their family). Returns 403 if denied, false if the check does not apply (non-parent role). */
async function assertParentOwnsDelegateOrAdmin(
  delegateChildId: number,
  userId: number,
  role: string,
  res: import("express").Response,
): Promise<boolean> {
  const ownChildIds = await getParentChildIds(userId, role);
  if (ownChildIds === null) return true; // admin/attendant — allow
  if (!ownChildIds.includes(delegateChildId)) {
    res.status(403).json({ error: "Forbidden", message: "Access denied" });
    return false;
  }
  return true;
}

router.get("/pickup-delegates/:id", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [delegate] = await db.select().from(pickupDelegatesTable).where(eq(pickupDelegatesTable.id, id));
  if (!delegate) { res.status(404).json({ error: "Not found", message: "Delegate not found" }); return; }
  if (!await assertParentOwnsDelegateOrAdmin(delegate.childId, req.user!.userId, req.user!.role, res)) return;
  res.json({ ...delegate, otpCode: undefined });
});

router.put("/pickup-delegates/:id/approve", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const [existing] = await db.select().from(pickupDelegatesTable).where(eq(pickupDelegatesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found", message: "Delegate not found" }); return; }
  if (!await assertParentOwnsDelegateOrAdmin(existing.childId, req.user!.userId, req.user!.role, res)) return;
  // Approval applies to the whole OTP group (one code may cover several children)
  const group = await getDelegateGroup(existing);
  const wasAlreadyApproved = group.every(g => g.approvalStatus === "approved");
  const updated = await db.update(pickupDelegatesTable)
    .set({ parentApproved: true, approvalStatus: "approved" })
    .where(inArray(pickupDelegatesTable.id, group.map(g => g.id))).returning();
  const delegate = updated.find(d => d.id === id) ?? updated[0];
  if (!delegate) { res.status(404).json({ error: "Not found", message: "Delegate not found" }); return; }
  // Only notify teachers on the actual transition to approved — retries stay silent
  if (!wasAlreadyApproved) {
    notifyTeachersDelegatePickup(group.map(g => g.childId), delegate.name, "approved").catch(() => {});
  }
  res.json({ ...delegate, otpCode: undefined });
});

/** Returns all delegate rows in the same OTP group (rows created together sharing one code), including the row itself. */
async function getDelegateGroup(delegate: typeof pickupDelegatesTable.$inferSelect) {
  if (!delegate.otpCode) return [delegate];
  const siblings = await db.select().from(pickupDelegatesTable)
    .where(eq(pickupDelegatesTable.otpCode, delegate.otpCode));
  return siblings.length ? siblings : [delegate];
}

router.post("/pickup-delegates/:id/notify-parent", authMiddleware, async (req, res): Promise<void> => {
  // Classification: the pending approval state and parent notification records
  // are AUTHORITATIVE and REQUIRED TRANSACTIONAL OUTBOX/INTENT respectively;
  // recipient/child/group reads are REQUIRED PRE-COMMIT VALIDATION; the teacher
  // heads-up is an OPTIONAL SECONDARY EFFECT.
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }

  const [delegate] = await db.select().from(pickupDelegatesTable).where(eq(pickupDelegatesTable.id, id));
  if (!delegate) { res.status(404).json({ error: "Not found", message: "Delegate not found" }); return; }
  if (!await assertParentOwnsDelegateOrAdmin(delegate.childId, req.user!.userId, req.user!.role, res)) return;

  // The OTP may cover multiple children — approval applies to the whole group.
  const group = await getDelegateGroup(delegate);
  const groupChildIds = group.map(g => g.childId);
  const children = await db.select().from(childrenTable).where(inArray(childrenTable.id, groupChildIds));
  if (children.length === 0) { res.status(404).json({ error: "Not found", message: "Child not found" }); return; }
  const childNames = children.map(c => `${c.firstName} ${c.lastName}`).join(", ");

  // Notify BOTH parents of every family involved (either may approve).
  const familyIds = [...new Set(children.map(c => c.familyId).filter(Boolean))] as number[];
  let parentUserIds: number[] = [];
  if (familyIds.length) {
    const families = await db.select().from(familiesTable).where(inArray(familiesTable.id, familyIds));
    parentUserIds = [...new Set(families.flatMap(f => [f.parent1Id, f.parent2Id]).filter(Boolean))] as number[];
  }
  if (parentUserIds.length === 0) { res.status(404).json({ error: "Not found", message: "Parent not found for this child" }); return; }

  const metadata = { delegateId: id, childId: children[0].id, childIds: groupChildIds, delegateName: delegate.name, requiresApproval: true };
  const groupIdentity = Math.min(...group.map(g => g.id));
  await db.transaction(async tx => {
    await tx.update(pickupDelegatesTable)
      .set({ approvalStatus: "pending", approvalRequestedAt: new Date() })
      .where(inArray(pickupDelegatesTable.id, group.map(g => g.id)));
    for (const parentUserId of parentUserIds) {
      await pickupDelegateRouteDependencies.createNotificationDelivery(tx, {
        logicalIdentity: `delegate-approval:${groupIdentity}:recipient:${parentUserId}`,
        domainType: "pickup_delegate",
        domainIdentifier: String(groupIdentity),
        projection: {
          userId: parentUserId,
          type: "delegate_approval_request",
          title: `🔔 Approve Pickup: ${children.length > 1 ? `${children.length} children` : children[0].firstName}`,
          message: `${delegate.name} is at the front desk to collect ${childNames}. Please approve or deny this pickup request.`,
          metadata,
        },
        channels: ["whatsapp"],
        templateKey: "delegate_approval_request",
        templateMetadata: metadata,
      });
    }
  });

  // Also warn the class teacher(s) so they can prepare — but not release yet
  notifyTeachersDelegatePickup(group.map(g => g.childId), delegate.name, "arrived").catch(error => {
    req.log.warn({ err: error, delegateId: id }, "Teacher delegate-arrival notification failed after approval request committed");
  });

  res.json({ success: true, requiresApproval: true, message: `Parent notified. Waiting for their approval before releasing ${childNames}.` });
});

/** Returns true if the user is authorised to approve/deny this delegate pickup.
 *  Authorised if: admin/attendant, OR parent owns the child, OR the system sent them
 *  a delegate_approval_request notification for this specific delegate. */
async function canActOnDelegateApproval(delegateId: number, childId: number, userId: number, role: string): Promise<boolean> {
  // Admins and attendants: always allowed
  if (role !== "parent") return true;
  // Parent owns the child: allowed
  const ownChildIds = await getParentChildIds(userId, role);
  if (ownChildIds && ownChildIds.includes(childId)) return true;
  // Parent was specifically notified about this delegate: allowed
  const notifs = await db.select().from(notificationsTable)
    .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.type, "delegate_approval_request")));
  return notifs.some(n => {
    try { return JSON.parse(n.metadataJson || "{}").delegateId === delegateId; } catch { return false; }
  });
}

router.post("/pickup-delegates/:id/approve", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }

  const [delegate] = await db.select().from(pickupDelegatesTable).where(eq(pickupDelegatesTable.id, id));
  if (!delegate) { res.status(404).json({ error: "Not found", message: "Delegate not found" }); return; }
  if (!await canActOnDelegateApproval(id, delegate.childId, req.user!.userId, req.user!.role)) {
    res.status(403).json({ error: "Forbidden", message: "Access denied" }); return;
  }

  const group = await getDelegateGroup(delegate);
  const wasAlreadyApproved = group.every(g => g.approvalStatus === "approved");
  const updatedRows = await db.update(pickupDelegatesTable)
    .set({ parentApproved: true, approvalStatus: "approved" })
    .where(inArray(pickupDelegatesTable.id, group.map(g => g.id))).returning();
  const updated = updatedRows.find(d => d.id === id) ?? updatedRows[0];

  // Only notify teachers on the actual transition to approved — retries stay silent
  if (!wasAlreadyApproved) {
    notifyTeachersDelegatePickup(group.map(g => g.childId), delegate.name, "approved").catch(() => {});
  }
  res.json({ success: true, delegate: updated, message: "Pickup approved. Child may be released." });
});

router.post("/pickup-delegates/:id/deny", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }

  const [delegate] = await db.select().from(pickupDelegatesTable).where(eq(pickupDelegatesTable.id, id));
  if (!delegate) { res.status(404).json({ error: "Not found", message: "Delegate not found" }); return; }
  if (!await canActOnDelegateApproval(id, delegate.childId, req.user!.userId, req.user!.role)) {
    res.status(403).json({ error: "Forbidden", message: "Access denied" }); return;
  }

  const group = await getDelegateGroup(delegate);
  const updatedRows = await db.update(pickupDelegatesTable)
    .set({ approvalStatus: "denied" })
    .where(inArray(pickupDelegatesTable.id, group.map(g => g.id))).returning();
  const updated = updatedRows.find(d => d.id === id) ?? updatedRows[0];

  res.json({ success: true, delegate: updated, message: "Pickup denied. Front desk has been notified." });
});

router.delete("/pickup-delegates/:id", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }

  const [existing] = await db.select().from(pickupDelegatesTable).where(eq(pickupDelegatesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found", message: "Delegate not found" }); return; }
  if (!await assertParentOwnsDelegateOrAdmin(existing.childId, req.user!.userId, req.user!.role, res)) return;

  await db.delete(pickupDelegatesTable).where(eq(pickupDelegatesTable.id, id));

  res.json({ success: true, message: "Delegate removed successfully" });
});

export default router;
