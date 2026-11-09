import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// Liveness: the process is up. Replit's deployment health check uses this, so
// it deliberately does not depend on the database (a DB blip must not make the
// host kill and restart a process that would recover on its own).
router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Readiness: the API can actually serve requests. Point uptime monitoring here.
router.get("/readyz", async (_req, res) => {
  const started = Date.now();
  try {
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise((_, reject) => setTimeout(() => reject(new Error("database check timed out")), 3000).unref()),
    ]);
    res.json({ status: "ok", database: "ok", latencyMs: Date.now() - started });
  } catch {
    res.status(503).json({ status: "degraded", database: "unreachable" });
  }
});

export default router;
