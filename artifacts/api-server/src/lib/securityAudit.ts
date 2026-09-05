import type { Request } from "express";
import { auditLogsTable, db } from "@workspace/db";
import { logger } from "./logger";

export async function securityAudit(
  req: Request,
  action: string,
  userId?: number,
  metadata?: Record<string, string | number | boolean | null>,
): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      userId: userId ?? req.user?.userId,
      action,
      entityType: "authentication",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || null,
      metadataJson: JSON.stringify({
        requestId: req.id,
        role: req.user?.role ?? null,
        ...metadata,
      }),
    });
  } catch (err) {
    logger.warn({ err, action, userId }, "Failed to write security audit event");
  }
}