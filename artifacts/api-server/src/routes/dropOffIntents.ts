import { Router } from "express";
import { eq, and, ne, inArray } from "drizzle-orm";
import { db, dropOffIntentsTable, familiesTable, childrenTable, usersTable } from "@workspace/db";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { sendToRole } from "../lib/notify";

const router = Router();

/** Business day in West Africa Time (UTC+1). */
function todayWAT(): string {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Resolve the family owned by this parent user. */
async function getParentFamily(userId: number) {
  const [fam] = await db.select().from(familiesTable)
    .where(eq(familiesTable.parent1Id, userId));
  if (fam) return fam;
  const [fam2] = await db.select().from(familiesTable)
    .where(eq(familiesTable.parent2Id, userId));
  return fam2 ?? null;
}

/**
 * POST /drop-off-intents
 * Parent signals "we're on our way" before arriving at church.
 * One intent per family per day; re-posting reactivates a cancelled intent.
 */
router.post("/drop-off-intents", authMiddleware, requireRoles("parent"), async (req, res): Promise<void> => {
  const family = await getParentFamily(req.user!.userId);
  if (!family) { res.status(404).json({ error: "Not found", message: "No family found for your account" }); return; }

  const serviceDate = todayWAT();

  // Validate the requested children + service slot
  const body = (req.body ?? {}) as { childIds?: unknown; serviceSlot?: unknown };
  const familyChildren = await db.select().from(childrenTable).where(eq(childrenTable.familyId, family.id));
  const familyChildIds = new Set(familyChildren.map(c => c.id));
  let childIds: number[] | null = null;
  if (Array.isArray(body.childIds) && body.childIds.length > 0) {
    childIds = body.childIds.filter((id): id is number => typeof id === "number" && familyChildIds.has(id));
    if (childIds.length === 0) {
      res.status(400).json({ error: "Bad request", message: "None of the selected children belong to your family" });
      return;
    }
  }
  const serviceSlot: "7am" | "10:30am" | "both" =
    body.serviceSlot === "7am" || body.serviceSlot === "10:30am" ? body.serviceSlot : "both";

  // Only create a new intent or reactivate a cancelled one. 'arrived' is
  // terminal for the day, and a duplicate tap while already on the way
  // must not re-alert the check-in desk.
  const [existing] = await db.select().from(dropOffIntentsTable)
    .where(and(
      eq(dropOffIntentsTable.familyId, family.id),
      eq(dropOffIntentsTable.serviceDate, serviceDate),
    ));
  if (existing?.status === "on_the_way") {
    // Allow updating the selection without re-alerting the desk
    const [updated] = await db.update(dropOffIntentsTable)
      .set({ childIds, serviceSlot })
      .where(and(eq(dropOffIntentsTable.id, existing.id), eq(dropOffIntentsTable.status, "on_the_way")))
      .returning();
    res.json({ success: true, intent: updated ?? existing });
    return;
  }
  if (existing?.status === "arrived") {
    res.status(409).json({ error: "Conflict", message: "Your family has already been checked in today." });
    return;
  }

  const [intent] = await db.insert(dropOffIntentsTable)
    .values({ familyId: family.id, serviceDate, status: "on_the_way", createdBy: req.user!.userId, childIds, serviceSlot })
    .onConflictDoUpdate({
      target: [dropOffIntentsTable.familyId, dropOffIntentsTable.serviceDate],
      set: { status: "on_the_way", createdBy: req.user!.userId, childIds, serviceSlot },
      // Guard against a race with check-in: never flip an 'arrived' intent back
      setWhere: ne(dropOffIntentsTable.status, "arrived"),
    })
    .returning();
  if (!intent) { res.status(409).json({ error: "Conflict", message: "Your family has already been checked in today." }); return; }

  // Let the check-in desk know a family is inbound
  const bringing = childIds ? familyChildren.filter(c => childIds!.includes(c.id)) : familyChildren;
  const childNames = bringing.map(c => c.firstName).join(", ");
  const slotLabel = serviceSlot === "both" ? "both services" : `the ${serviceSlot} service`;
  const [parent] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  const parentName = parent ? `${parent.firstName} ${parent.lastName}` : "A parent";
  for (const role of ["support"] as const) {
    sendToRole({
      role,
      type: "drop_off_incoming",
      title: "Family On The Way",
      message: `${parentName} (${family.familyCode ?? `Family #${family.id}`}) is on the way with ${childNames || "their children"} for ${slotLabel}. Scan their family QR on arrival to check the children straight in.`,
      metadata: { familyId: family.id, intentId: intent.id },
    }).catch(() => {});
  }

  res.json({ success: true, intent });
});

/**
 * DELETE /drop-off-intents
 * Parent cancels today's "on our way" signal.
 */
router.delete("/drop-off-intents", authMiddleware, requireRoles("parent"), async (req, res): Promise<void> => {
  const family = await getParentFamily(req.user!.userId);
  if (!family) { res.status(404).json({ error: "Not found", message: "No family found for your account" }); return; }
  await db.update(dropOffIntentsTable)
    .set({ status: "cancelled" })
    .where(and(
      eq(dropOffIntentsTable.familyId, family.id),
      eq(dropOffIntentsTable.serviceDate, todayWAT()),
    ));
  res.json({ success: true });
});

/**
 * GET /drop-off-intents/mine — parent's own intent for today (if any).
 */
router.get("/drop-off-intents/mine", authMiddleware, requireRoles("parent"), async (req, res): Promise<void> => {
  const family = await getParentFamily(req.user!.userId);
  if (!family) { res.json({ intent: null }); return; }
  const [intent] = await db.select().from(dropOffIntentsTable)
    .where(and(
      eq(dropOffIntentsTable.familyId, family.id),
      eq(dropOffIntentsTable.serviceDate, todayWAT()),
    ));
  res.json({ intent: intent ?? null });
});

/**
 * GET /drop-off-intents — staff view of today's expected arrivals.
 */
router.get("/drop-off-intents", authMiddleware, requireRoles("super_admin", "admin", "support", "attendant"), async (_req, res): Promise<void> => {
  const intents = await db.select().from(dropOffIntentsTable)
    .where(and(
      eq(dropOffIntentsTable.serviceDate, todayWAT()),
      eq(dropOffIntentsTable.status, "on_the_way"),
    ));
  if (intents.length === 0) { res.json([]); return; }

  const familyIds = intents.map(i => i.familyId);
  const [families, children] = await Promise.all([
    db.select().from(familiesTable).where(inArray(familiesTable.id, familyIds)),
    db.select().from(childrenTable).where(inArray(childrenTable.familyId, familyIds)),
  ]);
  const parentIds = [...new Set(families.flatMap(f => [f.parent1Id, f.parent2Id]).filter(Boolean))] as number[];
  const parents = parentIds.length
    ? await db.select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName })
        .from(usersTable).where(inArray(usersTable.id, parentIds))
    : [];

  res.json(intents.map(i => {
    const family = families.find(f => f.id === i.familyId) ?? null;
    const parent = parents.find(p => p.id === family?.parent1Id) ?? null;
    return {
      id: i.id,
      familyId: i.familyId,
      serviceDate: i.serviceDate,
      status: i.status,
      serviceSlot: i.serviceSlot,
      createdAt: i.createdAt,
      // Minimal projection only — the desk needs the code and names, not the family record
      family: family ? { id: family.id, familyCode: family.familyCode } : null,
      parentName: parent ? `${parent.firstName} ${parent.lastName}` : null,
      children: children
        .filter(c => c.familyId === i.familyId && (!i.childIds || i.childIds.length === 0 || i.childIds.includes(c.id)))
        .map(c => ({ id: c.id, firstName: c.firstName, lastName: c.lastName })),
    };
  }));
});

export default router;
