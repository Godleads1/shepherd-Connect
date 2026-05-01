import { Router } from "express";
import { eq, and, gte, lte, ilike, sql } from "drizzle-orm";
import { db, auditLogsTable, usersTable } from "@workspace/db";
import { ListAuditLogsQueryParams } from "@workspace/api-zod";
import { authMiddleware, requireRoles } from "../middlewares/auth";

const router = Router();

router.get("/audit-logs", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const params = ListAuditLogsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: "Bad request", message: params.error.message }); return; }
  const { userId, action, startDate, endDate, page = 1, limit = 50 } = params.data;
  const offset = (page - 1) * limit;
  const conditions = [];
  if (userId) conditions.push(eq(auditLogsTable.userId, userId));
  if (action) conditions.push(ilike(auditLogsTable.action, `%${action}%`));
  if (startDate) conditions.push(gte(auditLogsTable.timestamp, new Date(startDate)));
  if (endDate) conditions.push(lte(auditLogsTable.timestamp, new Date(endDate)));
  const logs = await db.select().from(auditLogsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(auditLogsTable.timestamp)
    .limit(limit).offset(offset);
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(auditLogsTable)
    .where(conditions.length ? and(...conditions) : undefined);
  const withUsers = await Promise.all(logs.map(async (log) => {
    let user = null;
    if (log.userId) {
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, log.userId));
      user = u ? { id: u.id, email: u.email, phone: u.phone, role: u.role, firstName: u.firstName, lastName: u.lastName, isActive: u.isActive, createdAt: u.createdAt } : null;
    }
    return { ...log, user };
  }));
  res.json({ data: withUsers, total: Number(count), page, limit });
});

export default router;
