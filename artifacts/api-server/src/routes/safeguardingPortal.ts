import { Router } from "express";
import { db } from "@workspace/db";
import {
  safeguardingAcknowledgementsTable,
  parentConcernsTable,
  usersTable,
  childrenTable,
} from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { authMiddleware, requireRoles } from "../middlewares/auth";

const router = Router();

const POLICY_VERSION = "v1.0";

// ── ACKNOWLEDGEMENTS ──────────────────────────────────────────────────────────

// GET /safeguarding-portal/ack — get current user's acknowledgement status
router.get("/safeguarding-portal/ack", authMiddleware, async (req, res): Promise<void> => {
  const userId = (req as any).user.userId;
  const [ack] = await db
    .select()
    .from(safeguardingAcknowledgementsTable)
    .where(
      and(
        eq(safeguardingAcknowledgementsTable.userId, userId),
        eq(safeguardingAcknowledgementsTable.policyVersion, POLICY_VERSION),
      ),
    );
  res.json({ acknowledged: !!ack, acknowledgedAt: ack?.acknowledgedAt ?? null, policyVersion: POLICY_VERSION });
});

// POST /safeguarding-portal/ack — record acknowledgement
router.post("/safeguarding-portal/ack", authMiddleware, async (req, res): Promise<void> => {
  const userId = (req as any).user.userId;
  const [existing] = await db
    .select()
    .from(safeguardingAcknowledgementsTable)
    .where(
      and(
        eq(safeguardingAcknowledgementsTable.userId, userId),
        eq(safeguardingAcknowledgementsTable.policyVersion, POLICY_VERSION),
      ),
    );
  if (existing) {
    res.json({ success: true, acknowledgedAt: existing.acknowledgedAt });
    return;
  }
  const [ack] = await db
    .insert(safeguardingAcknowledgementsTable)
    .values({ userId, policyVersion: POLICY_VERSION })
    .returning();
  req.log.info({ userId }, "Safeguarding policy acknowledged");
  res.status(201).json({ success: true, acknowledgedAt: ack.acknowledgedAt });
});

// ── PARENT CONCERNS ───────────────────────────────────────────────────────────

function generateRef(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `SC-${year}-${rand}`;
}

// POST /safeguarding-portal/concerns — parent submits a concern
router.post("/safeguarding-portal/concerns", authMiddleware, requireRoles("parent", "admin", "super_admin"), async (req, res): Promise<void> => {
  const userId = (req as any).user.userId;
  const { type, description, childId } = req.body as {
    type: string;
    description: string;
    childId?: number;
  };

  const VALID_TYPES = ["safeguarding_concern", "complaint", "compliment", "general_feedback"];
  if (!VALID_TYPES.includes(type)) {
    res.status(400).json({ error: "Bad request", message: "Invalid concern type" });
    return;
  }
  if (!description || description.trim().length < 10) {
    res.status(400).json({ error: "Bad request", message: "Please provide a description of at least 10 characters." });
    return;
  }

  let ref = generateRef();
  // Ensure uniqueness (extremely unlikely collision but belt-and-braces)
  const [clash] = await db.select().from(parentConcernsTable).where(eq(parentConcernsTable.referenceNumber, ref));
  if (clash) ref = generateRef();

  const [concern] = await db.insert(parentConcernsTable).values({
    referenceNumber: ref,
    parentUserId: userId,
    type: type as any,
    description: description.trim(),
    childId: childId ?? null,
    status: "open",
  }).returning();

  req.log.info({ userId, ref, type }, "Parent concern submitted");
  res.status(201).json({ success: true, referenceNumber: ref, concern });
});

// GET /safeguarding-portal/concerns — parent: own concerns; admin: all
router.get("/safeguarding-portal/concerns", authMiddleware, async (req, res): Promise<void> => {
  const { user } = req as any;
  const isAdmin = user.role === "admin" || user.role === "super_admin";

  const rows = await db
    .select({
      id: parentConcernsTable.id,
      referenceNumber: parentConcernsTable.referenceNumber,
      type: parentConcernsTable.type,
      description: parentConcernsTable.description,
      status: parentConcernsTable.status,
      adminNotes: parentConcernsTable.adminNotes,
      createdAt: parentConcernsTable.createdAt,
      updatedAt: parentConcernsTable.updatedAt,
      resolvedAt: parentConcernsTable.resolvedAt,
      childId: parentConcernsTable.childId,
      parentUserId: parentConcernsTable.parentUserId,
      parentFirstName: usersTable.firstName,
      parentLastName: usersTable.lastName,
      parentEmail: usersTable.email,
    })
    .from(parentConcernsTable)
    .innerJoin(usersTable, eq(parentConcernsTable.parentUserId, usersTable.id))
    .where(isAdmin ? undefined : eq(parentConcernsTable.parentUserId, user.userId))
    .orderBy(desc(parentConcernsTable.createdAt));

  res.json(rows);
});

// PUT /safeguarding-portal/concerns/:id — admin updates status/notes
router.put("/safeguarding-portal/concerns/:id", authMiddleware, requireRoles("admin", "super_admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }

  const { status, adminNotes } = req.body as { status?: string; adminNotes?: string };
  const VALID_STATUSES = ["open", "under_review", "resolved", "closed"];
  if (status && !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: "Bad request", message: "Invalid status" }); return;
  }

  const [existing] = await db.select().from(parentConcernsTable).where(eq(parentConcernsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const resolvedAt = status === "resolved" || status === "closed" ? new Date() : existing.resolvedAt;

  const [updated] = await db.update(parentConcernsTable)
    .set({
      ...(status ? { status: status as any } : {}),
      ...(adminNotes !== undefined ? { adminNotes } : {}),
      resolvedAt,
      updatedAt: new Date(),
    })
    .where(eq(parentConcernsTable.id, id))
    .returning();

  req.log.info({ id, status }, "Concern status updated");
  res.json({ success: true, concern: updated });
});

export default router;
