import { and, eq, inArray, ne } from "drizzle-orm";
import {
  childrenTable,
  db,
  teacherAllocationsTable,
  teachersTable,
  usersTable,
} from "@workspace/db";
import type { JwtPayload } from "../middlewares/auth";

export const FAMILY_CHILD_OPERATIONAL_ROLES = ["super_admin", "admin", "support"] as const;

export function isFamilyChildOperationalRole(role: string): boolean {
  return (FAMILY_CHILD_OPERATIONAL_ROLES as readonly string[]).includes(role);
}

export function canCreateOrEditFamily(role: string): boolean {
  return role === "parent" || isFamilyChildOperationalRole(role);
}

export function canCreateOrEditChild(role: string): boolean {
  return role === "parent" || isFamilyChildOperationalRole(role);
}

export function canManageChildBiometrics(role: string): boolean {
  return role === "parent" || role === "admin" || role === "super_admin";
}

export function canOperatePickupDelegates(role: string): boolean {
  return role === "parent" || isFamilyChildOperationalRole(role);
}

export function canReadSafeguardingTeacher(
  user: Pick<JwtPayload, "userId" | "role">,
  teacherUserId: number,
): boolean {
  return user.role === "admin"
    || user.role === "super_admin"
    || (user.role === "teacher" && user.userId === teacherUserId);
}

export async function getTeacherClassIds(userId: number, executor: any = db): Promise<number[]> {
  const [user] = await executor.select({ primaryClassId: usersTable.primaryClassId })
    .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const [teacher] = await executor.select({ id: teachersTable.id })
    .from(teachersTable).where(eq(teachersTable.userId, userId)).limit(1);
  const allocations = teacher
    ? await executor.select({ classId: teacherAllocationsTable.classId })
      .from(teacherAllocationsTable)
      .where(and(
        eq(teacherAllocationsTable.teacherId, teacher.id),
        ne(teacherAllocationsTable.status, "cancelled"),
      ))
    : [];
  const ids = new Set<number>();
  if (user?.primaryClassId) ids.add(user.primaryClassId);
  for (const allocation of allocations) ids.add(allocation.classId);
  return [...ids];
}

export async function teacherCanReadChild(userId: number, childId: number, executor: any = db): Promise<boolean> {
  const classIds = await getTeacherClassIds(userId, executor);
  if (!classIds.length) return false;
  const [child] = await executor.select({ id: childrenTable.id }).from(childrenTable)
    .where(and(eq(childrenTable.id, childId), inArray(childrenTable.currentClassId, classIds)))
    .limit(1);
  return Boolean(child);
}