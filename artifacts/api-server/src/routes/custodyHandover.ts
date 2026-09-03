import { Router } from "express";
import { AcceptCustodyEpisodeBody, OverrideCustodyPickupBody, RequestCustodyEpisodeBody } from "@workspace/api-zod";
import { and, eq, inArray, or } from "drizzle-orm";
import { childrenTable, custodyEpisodesTable, db, familiesTable } from "@workspace/db";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { acceptPhysicalCustody, cancelCustodyRequest, CustodyHandoverError, releasePhysicalCustody, requestCustodyEpisode } from "../services/custodyHandover";

const router = Router();

router.post("/custody-requests", authMiddleware, requireRoles("parent"), async (req, res): Promise<void> => {
  const parsed = RequestCustodyEpisodeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  try {
    const outcome = await db.transaction(tx => requestCustodyEpisode(tx, { ...parsed.data, requestedBy: req.user!.userId }));
    res.status(outcome.duplicate ? 200 : 201).json(outcome);
  } catch (error) {
    if (error instanceof CustodyHandoverError) { res.status(error.statusCode).json({ error: "Custody request rejected", message: error.message }); return; }
    throw error;
  }
});

router.get("/custody-requests", authMiddleware, requireRoles("parent"), async (req, res): Promise<void> => {
  const families = await db.select({ id: familiesTable.id }).from(familiesTable).where(or(
    eq(familiesTable.parent1Id, req.user!.userId), eq(familiesTable.parent2Id, req.user!.userId),
  ));
  const ids = families.map(f => f.id);
  res.json(ids.length ? await db.select().from(custodyEpisodesTable).where(inArray(custodyEpisodesTable.familyId, ids)) : []);
});

router.delete("/custody-requests/:id", authMiddleware, requireRoles("parent"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) { res.status(400).json({ error: "Bad request", message: "Invalid episode ID" }); return; }
  try {
    res.json(await db.transaction(tx => cancelCustodyRequest(tx, { episodeId: id, parentUserId: req.user!.userId })));
  } catch (error) {
    if (error instanceof CustodyHandoverError) { res.status(error.statusCode).json({ error: "Custody request rejected", message: error.message }); return; }
    throw error;
  }
});

router.get("/custody-episodes/pending", authMiddleware, requireRoles("support", "admin", "super_admin"), async (_req, res): Promise<void> => {
  const rows = await db.select({
    episode: custodyEpisodesTable,
    childFirstName: childrenTable.firstName,
    childLastName: childrenTable.lastName,
    familyCode: familiesTable.familyCode,
  }).from(custodyEpisodesTable)
    .innerJoin(childrenTable, eq(childrenTable.id, custodyEpisodesTable.childId))
    .innerJoin(familiesTable, eq(familiesTable.id, custodyEpisodesTable.familyId))
    .where(eq(custodyEpisodesTable.status, "requested"));
  res.json(rows.map(({ episode, childFirstName, childLastName, familyCode }) => ({
    ...episode,
    child: { firstName: childFirstName, lastName: childLastName },
    family: { familyCode },
  })));
});

router.post("/custody-episodes", authMiddleware, requireRoles("support"), async (req, res): Promise<void> => {
  const parsed = AcceptCustodyEpisodeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
  try {
    const outcome = await db.transaction(tx => acceptPhysicalCustody(tx, { ...parsed.data, custodianUserId: req.user!.userId }));
    res.status(outcome.duplicate ? 200 : 201).json(outcome);
  } catch (error) {
    if (error instanceof CustodyHandoverError) { res.status(error.statusCode).json({ error: "Custody handover rejected", message: error.message }); return; }
    throw error;
  }
});

router.post("/custody-episodes/:id/pickup", authMiddleware, requireRoles("support"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) { res.status(400).json({ error: "Bad request", message: "Invalid episode ID" }); return; }
  try {
    res.json(await db.transaction(tx => releasePhysicalCustody(tx, { episodeId: id, actorUserId: req.user!.userId })));
  } catch (error) {
    if (error instanceof CustodyHandoverError) { res.status(error.statusCode).json({ error: "Custody handover rejected", message: error.message }); return; }
    throw error;
  }
});

router.post("/custody-episodes/:id/override-pickup", authMiddleware, requireRoles("admin", "super_admin"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = OverrideCustodyPickupBody.safeParse(req.body);
  if (!Number.isInteger(id) || id < 1 || !parsed.success || !parsed.data.reason.trim()) { res.status(400).json({ error: "Bad request", message: parsed.success ? "A non-blank reason is required" : parsed.error.message }); return; }
  try {
    res.json(await db.transaction(tx => releasePhysicalCustody(tx, { episodeId: id, actorUserId: req.user!.userId, overrideReason: parsed.data.reason.trim() })));
  } catch (error) {
    if (error instanceof CustodyHandoverError) { res.status(error.statusCode).json({ error: "Custody handover rejected", message: error.message }); return; }
    throw error;
  }
});

export default router;