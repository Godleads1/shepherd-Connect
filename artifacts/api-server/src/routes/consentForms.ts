import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, consentFormsTable, childrenTable, usersTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/auth";
import { z } from "zod";

const router = Router();

const CONSENT_TYPES = ["photo", "medical_treatment", "trips", "social_media", "emergency_contact"] as const;

const UpsertConsentBody = z.object({
  type: z.enum(CONSENT_TYPES),
  granted: z.boolean(),
  notes: z.string().optional(),
  expiresAt: z.string().optional(),
});

router.get("/children/:childId/consent-forms", authMiddleware, async (req, res): Promise<void> => {
  const childId = parseInt(req.params.childId as string, 10);
  if (isNaN(childId)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const forms = await db.select().from(consentFormsTable).where(eq(consentFormsTable.childId, childId));
  const allTypes: typeof CONSENT_TYPES[number][] = [...CONSENT_TYPES];
  const formsMap = Object.fromEntries(forms.map(f => [f.type, f]));
  const result = allTypes.map(type => formsMap[type] || {
    id: null, childId, type, granted: false, notes: null, grantedAt: null, expiresAt: null,
  });
  res.json(result);
});

router.put("/children/:childId/consent-forms", authMiddleware, async (req, res): Promise<void> => {
  const childId = parseInt(req.params.childId as string, 10);
  if (isNaN(childId)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
  const parsed = UpsertConsentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }

  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId));
  if (!child) { res.status(404).json({ error: "Not found", message: "Child not found" }); return; }

  const [existing] = await db.select().from(consentFormsTable)
    .where(and(eq(consentFormsTable.childId, childId), eq(consentFormsTable.type, parsed.data.type)));

  const now = new Date();
  const values = {
    childId,
    parentId: req.user!.userId,
    type: parsed.data.type,
    granted: parsed.data.granted,
    notes: parsed.data.notes ?? null,
    grantedAt: parsed.data.granted ? now : null,
    expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    updatedAt: now,
  };

  let result;
  if (existing) {
    [result] = await db.update(consentFormsTable).set(values).where(eq(consentFormsTable.id, existing.id)).returning();
  } else {
    [result] = await db.insert(consentFormsTable).values(values).returning();
  }
  res.json(result);
});

export default router;
