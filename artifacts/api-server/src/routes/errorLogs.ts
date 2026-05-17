import { Router } from "express";
import { desc, count } from "drizzle-orm";
import { db, errorLogsTable } from "@workspace/db";
import { authMiddleware, requireRoles } from "../middlewares/auth";

const router = Router();

router.get(
  "/error-logs",
  authMiddleware, requireRoles("super_admin", "admin"),
  async (req, res): Promise<void> => {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 50)));
    const offset = (page - 1) * limit;

    const [rows, [{ total }]] = await Promise.all([
      db
        .select()
        .from(errorLogsTable)
        .orderBy(desc(errorLogsTable.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(errorLogsTable),
    ]);

    res.json({ data: rows, total: Number(total), page, limit });
  },
);

router.delete(
  "/error-logs",
  authMiddleware, requireRoles("super_admin"),
  async (_req, res): Promise<void> => {
    await db.delete(errorLogsTable);
    res.json({ message: "Error logs cleared" });
  },
);

export default router;
