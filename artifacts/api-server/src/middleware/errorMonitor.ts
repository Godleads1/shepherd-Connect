import { type Request, type Response, type NextFunction } from "express";
import { db, errorLogsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { classifyError } from "../lib/httpErrors";

export async function errorMonitorMiddleware(
  err: Error & { status?: number; statusCode?: number },
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Client mistakes (malformed JSON, invalid ids/dates, duplicates) are
  // answered with 4xx and are not persisted: storing every bad request would
  // let junk traffic turn into database writes.
  const client = classifyError(err);
  if (client) {
    if (res.headersSent) { next(err); return; }
    res.status(client.status).json({
      error: client.status === 409 ? "Conflict" : client.status === 413 ? "Payload too large" : "Bad request",
      message: client.message,
    });
    return;
  }

  logger.error(
    { err, path: req.path, method: req.method, statusCode: 500 },
    "Unhandled error",
  );

  try {
    const userId = (req as any).user?.userId ?? null;
    await db.insert(errorLogsTable).values({
      message: err.message ?? "Unknown error",
      stack: err.stack ?? null,
      path: req.path,
      method: req.method,
      statusCode: 500,
      userId,
    });
  } catch (dbErr) {
    logger.error({ dbErr }, "Failed to save error log to DB");
  }

  if (res.headersSent) {
    next(err);
    return;
  }

  res.status(500).json({ error: "Internal server error" });
}
