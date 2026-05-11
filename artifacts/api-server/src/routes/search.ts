import { Router } from "express";
import { ilike, or } from "drizzle-orm";
import { db, childrenTable, familiesTable, usersTable } from "@workspace/db";
import { authMiddleware, requireRoles } from "../middlewares/auth";

const router = Router();

router.get("/search", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const { q } = req.query as { q?: string };
  if (!q || q.trim().length < 2) {
    res.json({ children: [], families: [], users: [] });
    return;
  }
  const query = q.trim();

  const [children, users, families] = await Promise.all([
    db.select().from(childrenTable)
      .where(or(ilike(childrenTable.firstName, `%${query}%`), ilike(childrenTable.lastName, `%${query}%`)))
      .limit(8),
    db.select({
      id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName,
      email: usersTable.email, role: usersTable.role, phone: usersTable.phone,
    }).from(usersTable)
      .where(or(
        ilike(usersTable.firstName, `%${query}%`),
        ilike(usersTable.lastName, `%${query}%`),
        ilike(usersTable.email, `%${query}%`),
      ))
      .limit(8),
    db.select().from(familiesTable)
      .where(ilike(familiesTable.familyCode, `%${query}%`))
      .limit(8),
  ]);

  res.json({
    children: children.map(c => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, type: "child" as const, href: `/children/${c.id}` })),
    families: families.map(f => ({ id: f.id, name: f.familyCode, type: "family" as const, href: `/families/${f.id}` })),
    users: users.map(u => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, email: u.email, role: u.role, type: "user" as const, href: `/users` })),
  });
});

export default router;
