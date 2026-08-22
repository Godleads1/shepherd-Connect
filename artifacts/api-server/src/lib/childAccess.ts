import { and, eq, ne } from "drizzle-orm";
import {
  db,
  teacherAllocationsTable,
  teachersTable,
} from "@workspace/db";
import type { JwtPayload } from "../middlewares/auth";

export const OPERATIONAL_ROLES = ["super_admin", "admin", "support", "attendant"] as const;
export const SCANNER_ROLES = OPERATIONAL_ROLES;

export function isOperationalRole(role: string): boolean {
  return (OPERATIONAL_ROLES as readonly string[]).includes(role);
}

export function canCreatePickupRequest(role: string, ownsChild: boolean): boolean {
  return isOperationalRole(role) || (role === "parent" && ownsChild);
}

export function canDismissPickupRequest(
  role: string,
  ownsChild: boolean,
  hasClassAccess: boolean,
): boolean {
  return isOperationalRole(role)
    || (role === "parent" && ownsChild)
    || (role === "teacher" && hasClassAccess);
}

export async function canAccessClass(
  user: Pick<JwtPayload, "userId" | "role">,
  classId: number,
  serviceDate: string,
): Promise<boolean> {
  if (isOperationalRole(user.role)) return true;
  if (user.role !== "teacher") return false;

  const [teacher] = await db
    .select({ id: teachersTable.id })
    .from(teachersTable)
    .where(eq(teachersTable.userId, user.userId))
    .limit(1);
  if (!teacher) return false;

  const [allocation] = await db
    .select({ id: teacherAllocationsTable.id })
    .from(teacherAllocationsTable)
    .where(and(
      eq(teacherAllocationsTable.teacherId, teacher.id),
      eq(teacherAllocationsTable.classId, classId),
      eq(teacherAllocationsTable.serviceDate, serviceDate),
      ne(teacherAllocationsTable.status, "cancelled"),
    ))
    .limit(1);

  return Boolean(allocation);
}