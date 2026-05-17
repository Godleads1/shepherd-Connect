import { type Request, type Response, type NextFunction } from "express";
import { db, errorLogsTable } from "@workspace/db";
import { logger } from "../lib/logger";

export async function errorMonitorMiddleware(
  err: Error & { status?: number; statusCode?: number },
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const statusCode = err.status ?? err.statusCode ?? 500;

  logger.error(
    { err, path: req.path, method: req.method, statusCode },
    "Unhandled error",
  );

  try {
    const userId = (req as any).user?.id ?? null;
    await db.insert(errorLogsTable).values({
      message: err.message ?? "Unknown error",
      stack: err.stack ?? null,
      path: req.path,
      method: req.method,
      statusCode,
      userId,
    });
  } catch (dbErr) {
    logger.error({ dbErr }, "Failed to save error log to DB");
  }

  if (res.headersSent) {
    next(err);
    return;
  }

  res.status(statusCode).json({
    error: statusCode === 500 ? "Internal server error" : err.message,
  });
}
