import type { NextFunction, Request, Response } from "express";
import { logger } from "./logger";

/**
 * Bad client input that reaches PostgreSQL (an out-of-range id, an impossible
 * date, an unknown enum value, a dangling reference or a duplicate) is the
 * caller's mistake, not a server fault. Map those to 4xx so they are not
 * reported, retried or alerted on as outages.
 */
const PG_CLIENT_ERRORS: Record<string, { status: number; message: string }> = {
  "22P02": { status: 400, message: "A value in the request has the wrong format." },
  "22003": { status: 400, message: "A number in the request is out of range." },
  "22007": { status: 400, message: "A date or time in the request is invalid." },
  "22008": { status: 400, message: "A date or time in the request is out of range." },
  "22001": { status: 400, message: "A value in the request is too long." },
  "22023": { status: 400, message: "A value in the request is invalid." },
  "23502": { status: 400, message: "A required value is missing." },
  "23514": { status: 400, message: "A value in the request is not allowed." },
  "23503": { status: 409, message: "This refers to a record that does not exist, or the record is still in use." },
  "23505": { status: 409, message: "This record already exists." },
};

function pgCode(err: unknown): string | undefined {
  let current: any = err;
  for (let depth = 0; current && depth < 4; depth++) {
    if (typeof current.code === "string" && /^[0-9A-Z]{5}$/.test(current.code)) return current.code;
    current = current.cause;
  }
  return undefined;
}

export function classifyError(err: unknown): { status: number; message: string } | null {
  const code = pgCode(err);
  if (code && PG_CLIENT_ERRORS[code]) return PG_CLIENT_ERRORS[code]!;
  const message = (err as { message?: unknown } | null)?.message;
  // drizzle throws this before querying when an update has no fields.
  if (typeof message === "string" && message.includes("No values to set")) {
    return { status: 400, message: "Nothing to update: provide at least one field." };
  }
  const status = (err as { status?: unknown; statusCode?: unknown } | null)?.status
    ?? (err as { statusCode?: unknown } | null)?.statusCode;
  if (typeof status === "number" && status >= 400 && status < 500) {
    return { status, message: typeof message === "string" ? message : "Bad request" };
  }
  return null;
}

/** For route-level catch blocks: 4xx for client mistakes, logged 500 otherwise. */
export function sendRouteError(req: Request, res: Response, err: unknown, fallback: string): void {
  if (res.headersSent) return;
  const client = classifyError(err);
  if (client) {
    res.status(client.status).json({ error: client.status === 409 ? "Conflict" : "Bad request", message: client.message });
    return;
  }
  (req.log ?? logger).error({ err }, fallback);
  res.status(500).json({ error: fallback });
}

const INT32_MAX = 2_147_483_647;
const NUMERIC_SEGMENT = /^[-+]?\d+(\.\d+)?$/;

/**
 * Every numeric id in this API is a positive PostgreSQL integer. Reject any
 * path segment that looks numeric but is not one (negative, decimal, or larger
 * than int32) before it reaches a handler, instead of letting PostgreSQL fail
 * with "out of range" (previously a 500 on 84 routes).
 */
export function rejectInvalidNumericPathSegments(req: Request, res: Response, next: NextFunction): void {
  for (const raw of req.path.split("/")) {
    if (!raw || !NUMERIC_SEGMENT.test(raw)) continue;
    if (!/^\d+$/.test(raw) || raw.length > 10 || Number(raw) > INT32_MAX) {
      res.status(400).json({ error: "Bad request", message: "Invalid ID" });
      return;
    }
  }
  next();
}

/** Express 5 leaves req.body undefined when no body is sent; handlers destructure it. */
export function defaultEmptyBody(req: Request, _res: Response, next: NextFunction): void {
  if (req.body === undefined || req.body === null) req.body = {};
  next();
}
