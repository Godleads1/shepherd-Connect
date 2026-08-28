import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { logger } from "../lib/logger";

const configuredSessionSecret = process.env.SESSION_SECRET;
if (!configuredSessionSecret) {
  throw new Error("SESSION_SECRET environment variable is required");
}
const JWT_SECRET: string = configuredSessionSecret;

export interface JwtPayload {
  userId: number;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  mfaOnly?: unknown;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    if (Object.prototype.hasOwnProperty.call(payload, "mfaOnly")) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized", message: "No token provided" });
    return;
  }
  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token" });
    return;
  }
  try {
    const [currentUser] = await db.select({
      id: usersTable.id,
      email: usersTable.email,
      role: usersTable.role,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      isActive: usersTable.isActive,
      status: usersTable.status,
      secondaryRoles: usersTable.secondaryRoles,
    }).from(usersTable).where(eq(usersTable.id, payload.userId));

    if (!currentUser || !currentUser.isActive || currentUser.status !== "active") {
      res.status(401).json({ error: "Unauthorized", message: "Account is not active" });
      return;
    }

    let secondaryRoles: string[] = [];
    if (currentUser.secondaryRoles) {
      try {
        const parsed = JSON.parse(currentUser.secondaryRoles);
        if (Array.isArray(parsed)) secondaryRoles = parsed.filter((role): role is string => typeof role === "string");
      } catch {
        secondaryRoles = [];
      }
    }
    const currentRoles = new Set<string>([currentUser.role, ...secondaryRoles]);
    if (!currentRoles.has(payload.role)) {
      res.status(401).json({ error: "Unauthorized", message: "Account role has changed" });
      return;
    }

    req.user = {
      userId: currentUser.id,
      email: currentUser.email,
      role: payload.role,
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
    };
    next();
  } catch (err) {
    logger.error({ err, userId: payload.userId }, "Failed to validate authenticated user");
    res.status(500).json({ error: "Internal server error", message: "Authentication service unavailable" });
  }
}

export function requireRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized", message: "Not authenticated" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden", message: "Insufficient permissions" });
      return;
    }
    next();
  };
}

export function auditLog(action: string, entityType?: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const { db, auditLogsTable } = await import("@workspace/db");
      await db.insert(auditLogsTable).values({
        userId: req.user?.userId,
        action,
        entityType,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] || null,
      });
    } catch (err) {
      logger.warn({ err }, "Failed to write audit log");
    }
    next();
  };
}
