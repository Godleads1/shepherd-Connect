import { Router } from "express";
import { ilike, or, eq, inArray } from "drizzle-orm";
import { db, childrenTable, familiesTable, usersTable, classAssignmentsTable, teacherAllocationsTable, teachersTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/auth";

const router = Router();

router.get("/search", authMiddleware, async (req, res): Promise<void> => {
  const { q } = req.query as { q?: string };
  const { userId, role } = req.user!;

  if (!q || q.trim().length < 2) {
    res.json({ children: [], families: [], users: [] });
    return;
  }
  const query = q.trim();
  const like = `%${query}%`;

  if (role === "super_admin" || role === "admin") {
    const [children, users, families] = await Promise.all([
      db.select().from(childrenTable)
        .where(or(ilike(childrenTable.firstName, like), ilike(childrenTable.lastName, like)))
        .limit(8),
      db.select({
        id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName,
        email: usersTable.email, role: usersTable.role, phone: usersTable.phone,
      }).from(usersTable)
        .where(or(
          ilike(usersTable.firstName, like),
          ilike(usersTable.lastName, like),
          ilike(usersTable.email, like),
        ))
        .limit(8),
      db.select().from(familiesTable)
        .where(ilike(familiesTable.familyCode, like))
        .limit(8),
    ]);
    res.json({
      children: children.map(c => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, type: "child" as const, href: `/children/${c.id}` })),
      families: families.map(f => ({ id: f.id, name: f.familyCode, type: "family" as const, href: `/families/${f.id}` })),
      users: users.map(u => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, email: u.email, role: u.role, type: "user" as const, href: `/users` })),
    });
    return;
  }

  if (role === "teacher") {
    const teacherRows = await db.select({ id: teachersTable.id })
      .from(teachersTable)
      .where(eq(teachersTable.userId, userId));
    if (teacherRows.length === 0) {
      res.json({ children: [], families: [], users: [] });
      return;
    }
    const teacherId = teacherRows[0].id;
    const allocations = await db.select({ classId: teacherAllocationsTable.classId })
      .from(teacherAllocationsTable)
      .where(eq(teacherAllocationsTable.teacherId, teacherId));
    const classIds = allocations.map(a => a.classId);
    if (classIds.length === 0) {
      res.json({ children: [], families: [], users: [] });
      return;
    }
    const assignments = await db.select({ childId: classAssignmentsTable.childId })
      .from(classAssignmentsTable)
      .where(inArray(classAssignmentsTable.classId, classIds));
    const childIds = assignments.map(a => a.childId);
    if (childIds.length === 0) {
      res.json({ children: [], families: [], users: [] });
      return;
    }
    const children = await db.select().from(childrenTable)
      .where(or(
        inArray(childrenTable.id, childIds),
        or(ilike(childrenTable.firstName, like), ilike(childrenTable.lastName, like))
      ))
      .limit(10);
    const filtered = children.filter(c =>
      childIds.includes(c.id) &&
      (`${c.firstName} ${c.lastName}`.toLowerCase().includes(query.toLowerCase()))
    );
    res.json({
      children: filtered.map(c => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, type: "child" as const, href: `/my-class` })),
      families: [],
      users: [],
    });
    return;
  }

  if (role === "parent") {
    const parentUser = await db.select({ familyId: usersTable.id }).from(usersTable).where(eq(usersTable.id, userId));
    const familyRows = await db.select().from(familiesTable)
      .where(ilike(familiesTable.familyCode, like))
      .limit(4);
    const children = await db.select().from(childrenTable)
      .where(or(ilike(childrenTable.firstName, like), ilike(childrenTable.lastName, like)))
      .limit(8);
    res.json({
      children: children.map(c => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, type: "child" as const, href: `/my-children` })),
      families: familyRows.map(f => ({ id: f.id, name: f.familyCode, type: "family" as const, href: `/my-family` })),
      users: [],
    });
    return;
  }

  if (role === "attendant") {
    const children = await db.select().from(childrenTable)
      .where(or(ilike(childrenTable.firstName, like), ilike(childrenTable.lastName, like)))
      .limit(10);
    res.json({
      children: children.map(c => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, type: "child" as const, href: `/checkin` })),
      families: [],
      users: [],
    });
    return;
  }

  res.json({ children: [], families: [], users: [] });
});

export default router;
