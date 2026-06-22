import { Router } from "express";
import { db } from "@workspace/db";
import { teacherIncidentsTable, usersTable, childrenTable } from "@workspace/db/schema";
import { eq, desc, and, or } from "drizzle-orm";
import { authMiddleware, requireRoles } from "../middlewares/auth";

const router = Router();

function generateRef(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `INC-${year}-${rand}`;
}

// POST /teacher-incidents — teacher submits incident report
router.post(
  "/teacher-incidents",
  authMiddleware,
  requireRoles("teacher", "admin", "super_admin"),
  async (req, res): Promise<void> => {
    const userId = (req as any).user.userId;
    const {
      childId,
      childName,
      incidentType,
      description,
      location,
      actionsTaken,
      parentCommunication,
      isHighRisk,
      incidentDate,
    } = req.body as {
      childId?: number;
      childName?: string;
      incidentType: string;
      description: string;
      location?: string;
      actionsTaken?: string;
      parentCommunication?: string;
      isHighRisk?: boolean;
      incidentDate?: string;
    };

    const VALID_TYPES = ["behavioural", "injury", "bullying", "medical", "safeguarding", "other"];
    if (!VALID_TYPES.includes(incidentType)) {
      res.status(400).json({ error: "Bad request", message: "Invalid incident type" });
      return;
    }
    if (!description || description.trim().length < 10) {
      res.status(400).json({ error: "Bad request", message: "Description must be at least 10 characters." });
      return;
    }

    let ref = generateRef();
    const [clash] = await db.select().from(teacherIncidentsTable).where(eq(teacherIncidentsTable.referenceNumber, ref));
    if (clash) ref = generateRef();

    const [incident] = await db.insert(teacherIncidentsTable).values({
      referenceNumber: ref,
      teacherUserId: userId,
      childId: childId ?? null,
      childName: childName ?? null,
      incidentType: incidentType as any,
      description: description.trim(),
      location: location ?? null,
      actionsTaken: actionsTaken ?? null,
      parentCommunication: parentCommunication ?? null,
      isHighRisk: isHighRisk ?? false,
      status: "open",
      incidentDate: incidentDate ? new Date(incidentDate) : new Date(),
    }).returning();

    req.log.info({ userId, ref, incidentType, isHighRisk }, "Incident report submitted");
    res.status(201).json({ success: true, referenceNumber: ref, incident });
  }
);

// GET /teacher-incidents — teacher: own reports; admin: all
router.get("/teacher-incidents", authMiddleware, async (req, res): Promise<void> => {
  const { user } = req as any;
  const isAdmin = user.role === "admin" || user.role === "super_admin";

  const rows = await db
    .select({
      id: teacherIncidentsTable.id,
      referenceNumber: teacherIncidentsTable.referenceNumber,
      incidentType: teacherIncidentsTable.incidentType,
      description: teacherIncidentsTable.description,
      location: teacherIncidentsTable.location,
      actionsTaken: teacherIncidentsTable.actionsTaken,
      parentCommunication: teacherIncidentsTable.parentCommunication,
      isHighRisk: teacherIncidentsTable.isHighRisk,
      status: teacherIncidentsTable.status,
      adminNotes: teacherIncidentsTable.adminNotes,
      incidentDate: teacherIncidentsTable.incidentDate,
      createdAt: teacherIncidentsTable.createdAt,
      updatedAt: teacherIncidentsTable.updatedAt,
      resolvedAt: teacherIncidentsTable.resolvedAt,
      childId: teacherIncidentsTable.childId,
      childName: teacherIncidentsTable.childName,
      teacherUserId: teacherIncidentsTable.teacherUserId,
      teacherFirstName: usersTable.firstName,
      teacherLastName: usersTable.lastName,
    })
    .from(teacherIncidentsTable)
    .innerJoin(usersTable, eq(teacherIncidentsTable.teacherUserId, usersTable.id))
    .where(isAdmin ? undefined : eq(teacherIncidentsTable.teacherUserId, user.userId))
    .orderBy(desc(teacherIncidentsTable.incidentDate));

  res.json(rows);
});

// PUT /teacher-incidents/:id — admin updates status/notes
router.put(
  "/teacher-incidents/:id",
  authMiddleware,
  requireRoles("admin", "super_admin"),
  async (req, res): Promise<void> => {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }

    const { status, adminNotes } = req.body as { status?: string; adminNotes?: string };
    const VALID_STATUSES = ["open", "under_review", "risk_assessed", "parent_notified", "follow_up", "escalated", "closed"];
    if (status && !VALID_STATUSES.includes(status)) {
      res.status(400).json({ error: "Bad request", message: "Invalid status" }); return;
    }

    const [existing] = await db.select().from(teacherIncidentsTable).where(eq(teacherIncidentsTable.id, id));
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }

    const resolvedAt = status === "closed" ? new Date() : existing.resolvedAt;

    const [updated] = await db.update(teacherIncidentsTable)
      .set({
        ...(status ? { status: status as any } : {}),
        ...(adminNotes !== undefined ? { adminNotes } : {}),
        resolvedAt,
        updatedAt: new Date(),
      })
      .where(eq(teacherIncidentsTable.id, id))
      .returning();

    req.log.info({ id, status }, "Incident status updated");
    res.json({ success: true, incident: updated });
  }
);

export default router;
