import { Router } from "express";
import { eq, inArray, isNull, and } from "drizzle-orm";
import { db, teachersTable, usersTable, classesTable, notificationsTable } from "@workspace/db";
import { CreateTeacherBody } from "@workspace/api-zod";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { z } from "zod";
import {
  canonicalPendingRoles,
  canonicalSecondaryRoles,
  lockUserById,
} from "../lib/roleMutations";

const UpdateTeacherUserBody = z.object({
  firstName:      z.string().min(1).optional(),
  lastName:       z.string().min(1).optional(),
  phone:          z.string().optional(),
  photoUrl:       z.string().optional(),
  primaryClassId: z.number().int().nullable().optional(),
});

const SelectClassBody = z.object({
  primaryClassId: z.number().int(),
});

const router = Router();

function sanitizeUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id, email: user.email, phone: user.phone, role: user.role,
    firstName: user.firstName, lastName: user.lastName, isActive: user.isActive,
    createdAt: user.createdAt, primaryClassId: user.primaryClassId,
  };
}

async function formatTeacher(t: typeof teachersTable.$inferSelect, query: Pick<typeof db, "select"> = db) {
  const [user] = await query.select().from(usersTable).where(eq(usersTable.id, t.userId));
  let primaryClass: { id: number; name: string } | null = null;
  if (user?.primaryClassId) {
    const [cls] = await query.select().from(classesTable).where(eq(classesTable.id, user.primaryClassId));
    if (cls) primaryClass = { id: cls.id, name: cls.name };
  }
  return { ...t, user: user ? sanitizeUser(user) : null, primaryClass };
}

router.get("/teachers", authMiddleware, async (_req, res): Promise<void> => {
  try {
    // Auto-sync: create teacher records for ALL teacher-role users (including pending approval)
    // so they appear in allocation dropdowns even before their first login.
    const [teacherUsers, existing] = await Promise.all([
      db.select().from(usersTable).where(eq(usersTable.role, "teacher")),
      db.select().from(teachersTable),
    ]);
    const existingUserIds = new Set(existing.map(t => t.userId));
    const missing = teacherUsers.filter(u => !existingUserIds.has(u.id));
    if (missing.length > 0) {
      await db.insert(teachersTable).values(missing.map(u => ({ userId: u.id }))).onConflictDoNothing();
    }

    // Single join — no N+1
    const rows = await db
      .select()
      .from(teachersTable)
      .leftJoin(usersTable, eq(teachersTable.userId, usersTable.id));

    // Collect unique class IDs to resolve names in one query
    const classIds = [...new Set(rows.map(r => r.users?.primaryClassId).filter(Boolean))] as number[];
    const classMap: Record<number, string> = {};
    if (classIds.length > 0) {
      const classes = await db.select().from(classesTable).where(
        classIds.length === 1
          ? eq(classesTable.id, classIds[0])
          : inArray(classesTable.id, classIds)
      );
      classes.forEach(c => { classMap[c.id] = c.name; });
    }

    const formatted = rows.map(row => ({
      ...row.teachers,
      user: row.users ? sanitizeUser(row.users) : null,
      primaryClass: row.users?.primaryClassId
        ? { id: row.users.primaryClassId, name: classMap[row.users.primaryClassId] ?? "Unknown Class" }
        : null,
    }));
    res.json(formatted);
  } catch (err) {
    (_req as any).log?.error({ err }, "Failed to list teachers");
    res.status(500).json({ error: "Failed to list teachers" });
  }
});

router.post("/teachers", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  // REQUIRED PRE-COMMIT VALIDATION: body and locked user existence.
  // PARTIAL-MULTI-WRITE COMMAND: teacher creation plus authoritative user role activation.
  // RESPONSE ENRICHMENT: user/class reads are required in that same transaction.
  try {
    const parsed = CreateTeacherBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
    const response = await db.transaction(async tx => {
      const user = await lockUserById(tx, parsed.data.userId);
      if (!user) throw new Error("Teacher user not found");
      const [created] = await tx.insert(teachersTable).values(parsed.data).returning();
      // Promote the user to teacher role and activate them so they appear in all teacher
      // dropdowns (including allocations) regardless of their original registration role.
      await tx.update(usersTable)
        .set({
          role: "teacher",
          isActive: true,
          status: "active",
          secondaryRoles: JSON.stringify(canonicalSecondaryRoles(user.secondaryRoles, "teacher")),
          pendingRoles: JSON.stringify(canonicalPendingRoles(user.pendingRoles)),
        })
        .where(eq(usersTable.id, parsed.data.userId));
      return formatTeacher(created, tx);
    });
    res.status(201).json(response);
  } catch (err) {
    req.log.error({ err }, "Failed to create teacher");
    res.status(500).json({ error: "Failed to create teacher" });
  }
});

router.get("/teachers/:id", authMiddleware, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
    const [teacher] = await db.select().from(teachersTable).where(eq(teachersTable.id, id));
    if (!teacher) { res.status(404).json({ error: "Not found", message: "Teacher not found" }); return; }
    res.json(await formatTeacher(teacher));
  } catch (err) {
    req.log.error({ err }, "Failed to get teacher");
    res.status(500).json({ error: "Failed to get teacher" });
  }
});

router.put("/teachers/:id", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  // REQUIRED PRE-COMMIT VALIDATION: id, body, teacher existence, and locked user existence.
  // AUTHORITATIVE: user profile/role update. RESPONSE ENRICHMENT: user/class reads are required in the same transaction.
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Bad request", message: "Invalid ID" }); return; }
    const parsed = UpdateTeacherUserBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }
    const { primaryClassId, ...userUpdates } = parsed.data;
    const result = await db.transaction(async tx => {
      const [teacher] = await tx.select().from(teachersTable).where(eq(teachersTable.id, id));
      if (!teacher) return { kind: "notFound" as const };
      const user = await lockUserById(tx, teacher.userId);
      if (!user) return { kind: "notFound" as const };
      // Always promote to teacher role and ensure active — mirrors the POST handler.
      const updates: Record<string, any> = {
        ...userUpdates,
        role: "teacher",
        isActive: true,
        status: "active",
        secondaryRoles: JSON.stringify(canonicalSecondaryRoles(user.secondaryRoles, "teacher")),
        pendingRoles: JSON.stringify(canonicalPendingRoles(user.pendingRoles)),
      };
      if (primaryClassId !== undefined) updates.primaryClassId = primaryClassId;
      await tx.update(usersTable).set(updates).where(eq(usersTable.id, teacher.userId));
      return { kind: "updated" as const, response: await formatTeacher(teacher, tx) };
    });
    if (result.kind === "notFound") { res.status(404).json({ error: "Not found", message: "Teacher not found" }); return; }
    res.json(result.response);
  } catch (err) {
    req.log.error({ err }, "Failed to update teacher");
    res.status(500).json({ error: "Failed to update teacher" });
  }
});

// Admin: notify all active teachers who haven't picked a class yet
router.post("/teachers/notify-select-class", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  try {
    // Find all active teacher-role users with no primaryClassId
    const unassigned = await db
      .select({ id: usersTable.id, firstName: usersTable.firstName, email: usersTable.email, phone: usersTable.phone })
      .from(usersTable)
      .where(and(
        eq(usersTable.role, "teacher"),
        eq(usersTable.isActive, true),
        isNull(usersTable.primaryClassId),
      ));

    if (unassigned.length === 0) {
      res.json({ success: true, sent: 0, message: "All active teachers already have a class assigned." });
      return;
    }

    const title = "Action Required: Pick Your Class 📚";
    const message = "You haven't selected your permanent class yet. Please log in to Shepherd Connect and go to My Class to pick your class. It only takes a few seconds!";

    // Insert in-app notifications in one batch
    await db.insert(notificationsTable).values(
      unassigned.map(u => ({
        userId: u.id,
        type: "broadcast" as const,
        title,
        message,
        channel: "in_app" as const,
        readStatus: false,
      }))
    );

    // Send WhatsApp/email to each in background
    const { sendWhatsAppWithFallback } = await import("../services/sms");
    const appUrl = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}/shepherd-connect/my-class` : "https://shepherdconnect.intelyticslimited.com/my-class";
    const fullMessage = `${message}\n\n👉 ${appUrl}`;

    Promise.all(
      unassigned.map(async u => {
        if (u.phone) sendWhatsAppWithFallback(u.phone, `*${title}*\n\n${fullMessage}`, req.log).catch(() => {});
        if (u.email) {
          const { Resend } = await import("resend");
          const resend = new Resend(process.env.RESEND_API_KEY);
          resend.emails.send({
            from: "Shepherd Connect <no-reply@shepherdconnect.intelyticslimited.com>",
            to: u.email,
            subject: title,
            html: `<p>Hi ${u.firstName},</p><p>${message}</p><p><a href="${appUrl}">Log in and pick your class →</a></p>`,
          }).catch(() => {});
        }
      })
    ).catch(() => {});

    res.json({ success: true, sent: unassigned.length, message: `Notified ${unassigned.length} teacher(s) to select their class.` });
  } catch (err) {
    req.log.error({ err }, "Failed to notify teachers to select class");
    res.status(500).json({ error: "Failed to send notifications" });
  }
});

// Teachers can self-select their primary class (only if they have none yet, or always — admin supersedes via PUT)
router.post("/teachers/me/select-class", authMiddleware, requireRoles("teacher", "admin", "super_admin"), async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const parsed = SelectClassBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Bad request", message: parsed.error.message }); return; }

    // Verify the class exists
    const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, parsed.data.primaryClassId));
    if (!cls) { res.status(404).json({ error: "Not found", message: "Class not found" }); return; }

    await db.update(usersTable)
      .set({ primaryClassId: parsed.data.primaryClassId })
      .where(eq(usersTable.id, userId));

    res.json({ success: true, primaryClass: { id: cls.id, name: cls.name } });
  } catch (err) {
    req.log.error({ err }, "Failed to select class");
    res.status(500).json({ error: "Failed to select class" });
  }
});

export default router;
