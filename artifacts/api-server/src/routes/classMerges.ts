import { Router } from "express";
import { db } from "@workspace/db";
import { classMergesTable, classesTable } from "@workspace/db/schema";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { eq, and } from "drizzle-orm";

const router = Router();

/**
 * GET /api/class-merges?date=YYYY-MM-DD
 * Returns all merges for a given date (defaults to today).
 * Accessible to admin and super_admin.
 */
router.get(
  "/class-merges",
  authMiddleware,
  requireRoles("super_admin", "admin"),
  async (req, res): Promise<void> => {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);

    const rows = await db
      .select({
        id: classMergesTable.id,
        sourceClassId: classMergesTable.sourceClassId,
        targetClassId: classMergesTable.targetClassId,
        serviceDate: classMergesTable.serviceDate,
        serviceSlot: classMergesTable.serviceSlot,
        createdAt: classMergesTable.createdAt,
        sourceClassName: classesTable.name,
      })
      .from(classMergesTable)
      .innerJoin(classesTable, eq(classMergesTable.sourceClassId, classesTable.id))
      .where(eq(classMergesTable.serviceDate, date));

    // Enrich with target class name
    const enriched = await Promise.all(
      rows.map(async (row) => {
        const [target] = await db
          .select({ name: classesTable.name })
          .from(classesTable)
          .where(eq(classesTable.id, row.targetClassId));
        return { ...row, targetClassName: target?.name ?? "Unknown" };
      }),
    );

    res.json(enriched);
  },
);

/**
 * POST /api/class-merges
 * Create a new class merge for a given date.
 */
router.post(
  "/class-merges",
  authMiddleware,
  requireRoles("super_admin", "admin"),
  async (req, res): Promise<void> => {
    const { sourceClassId, targetClassId, serviceDate, serviceSlot } = req.body as {
      sourceClassId?: number;
      targetClassId?: number;
      serviceDate?: string;
      serviceSlot?: "7am" | "10:30am" | null;
    };

    if (!sourceClassId || !targetClassId || !serviceDate) {
      res.status(400).json({ error: "Bad request", message: "sourceClassId, targetClassId, and serviceDate are required" });
      return;
    }

    if (sourceClassId === targetClassId) {
      res.status(400).json({ error: "Bad request", message: "A class cannot be merged with itself" });
      return;
    }

    // Prevent duplicate merges for the same source + date + slot
    const existing = await db
      .select({ id: classMergesTable.id })
      .from(classMergesTable)
      .where(
        and(
          eq(classMergesTable.sourceClassId, sourceClassId),
          eq(classMergesTable.serviceDate, serviceDate),
        ),
      );

    if (existing.length > 0) {
      res.status(409).json({ error: "Conflict", message: "A merge for this source class on this date already exists" });
      return;
    }

    const [row] = await db
      .insert(classMergesTable)
      .values({
        sourceClassId,
        targetClassId,
        serviceDate,
        serviceSlot: serviceSlot ?? null,
        createdBy: req.user!.userId,
      })
      .returning();

    res.status(201).json(row);
  },
);

/**
 * DELETE /api/class-merges/:id
 * Remove a class merge.
 */
router.delete(
  "/class-merges/:id",
  authMiddleware,
  requireRoles("super_admin", "admin"),
  async (req, res): Promise<void> => {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Bad request" }); return; }

    const [deleted] = await db
      .delete(classMergesTable)
      .where(eq(classMergesTable.id, id))
      .returning();

    if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true });
  },
);

export default router;
