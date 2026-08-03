import { Router } from "express";
import { db } from "@workspace/db";
import { hallSessionsTable } from "@workspace/db/schema";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { eq, and, or, isNull } from "drizzle-orm";

const router = Router();

/**
 * GET /api/hall-sessions/today
 * Public — clients check this to know whether a hall session is active.
 * Returns { active: boolean, sessions: [...] }
 */
router.get("/hall-sessions/today", async (_req, res): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);
  const sessions = await db
    .select()
    .from(hallSessionsTable)
    .where(eq(hallSessionsTable.serviceDate, today));

  res.json({ active: sessions.length > 0, sessions });
});

/**
 * GET /api/hall-sessions?date=YYYY-MM-DD
 * Admin — list hall sessions for a given date.
 */
router.get(
  "/hall-sessions",
  authMiddleware,
  requireRoles("super_admin", "admin", "support"),
  async (req, res): Promise<void> => {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const sessions = await db
      .select()
      .from(hallSessionsTable)
      .where(eq(hallSessionsTable.serviceDate, date));
    res.json(sessions);
  },
);

/**
 * POST /api/hall-sessions
 * Support+ — mark a hall session as active for a given date/slot.
 */
router.post(
  "/hall-sessions",
  authMiddleware,
  requireRoles("super_admin", "admin", "support"),
  async (req, res): Promise<void> => {
    const { serviceDate, serviceSlot } = req.body as {
      serviceDate?: string;
      serviceSlot?: "7am" | "10:30am" | null;
    };

    const date = serviceDate || new Date().toISOString().slice(0, 10);

    // Check for an existing session for the same date + slot combination
    const existing = await db
      .select({ id: hallSessionsTable.id })
      .from(hallSessionsTable)
      .where(
        and(
          eq(hallSessionsTable.serviceDate, date),
          serviceSlot
            ? eq(hallSessionsTable.serviceSlot, serviceSlot)
            : isNull(hallSessionsTable.serviceSlot),
        ),
      );

    if (existing.length > 0) {
      res.status(409).json({ error: "Conflict", message: "A hall session for this date and slot is already active" });
      return;
    }

    const [row] = await db
      .insert(hallSessionsTable)
      .values({
        serviceDate: date,
        serviceSlot: serviceSlot ?? null,
        createdBy: req.user!.userId,
      })
      .returning();

    res.status(201).json(row);
  },
);

/**
 * DELETE /api/hall-sessions/:id
 * Support+ — deactivate a hall session.
 */
router.delete(
  "/hall-sessions/:id",
  authMiddleware,
  requireRoles("super_admin", "admin", "support"),
  async (req, res): Promise<void> => {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Bad request" }); return; }

    const [deleted] = await db
      .delete(hallSessionsTable)
      .where(eq(hallSessionsTable.id, id))
      .returning();

    if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true });
  },
);

export default router;
