import { and, eq, inArray, isNull, or } from "drizzle-orm";
import {
  childrenTable,
  db,
  familiesTable,
  pickupDelegatesTable,
  privateObjectBindingsTable,
  teacherAllocationsTable,
  teachersTable,
  usersTable,
} from "@workspace/db";
import type { JwtPayload } from "../middlewares/auth";
import { canAccessClass, isOperationalRole } from "./childAccess";
import { parentOwnsChild } from "./parentScope";

type ResourceType = "user" | "child" | "pickup_delegate" | "class_display";

interface BindingState {
  uploaderId: number;
  resourceType: string | null;
  resourceId: number | null;
  revokedAt: Date | null;
}

export function canBindPendingObject(binding: BindingState | undefined, userId: number): boolean {
  return Boolean(
    binding
    && !binding.revokedAt
    && binding.uploaderId === userId
    && binding.resourceType === null
    && binding.resourceId === null,
  );
}

function isPrivateObjectPath(path: string | null | undefined): path is string {
  return Boolean(path?.startsWith("/objects/"));
}

export async function registerPendingObject(objectPath: string, uploaderId: number): Promise<void> {
  await db
    .insert(privateObjectBindingsTable)
    .values({ objectPath, uploaderId })
    .onConflictDoNothing({ target: privateObjectBindingsTable.objectPath });
}

export async function assertObjectCanBind(
  objectPath: string | null | undefined,
  user: Pick<JwtPayload, "userId" | "role">,
  executor: any = db,
): Promise<boolean> {
  if (!isPrivateObjectPath(objectPath)) return true;
  const [binding] = await executor
    .select()
    .from(privateObjectBindingsTable)
    .where(eq(privateObjectBindingsTable.objectPath, objectPath))
    .limit(1);
  return canBindPendingObject(binding, user.userId);
}

export async function bindObjectToResource(
  objectPath: string | null | undefined,
  resourceType: ResourceType,
  resourceId: number,
  user: Pick<JwtPayload, "userId" | "role">,
  executor: any = db,
): Promise<boolean> {
  if (!isPrivateObjectPath(objectPath)) return true;
  const [binding] = await executor
    .select()
    .from(privateObjectBindingsTable)
    .where(eq(privateObjectBindingsTable.objectPath, objectPath))
    .limit(1);
  if (!binding || binding.revokedAt) return false;
  if (binding.resourceType === resourceType && binding.resourceId === resourceId) return true;
  if (!(await assertObjectCanBind(objectPath, user, executor))) return false;

  const updated = await executor
    .update(privateObjectBindingsTable)
    .set({ resourceType, resourceId, boundAt: new Date() })
    .where(and(
      eq(privateObjectBindingsTable.objectPath, objectPath),
      eq(privateObjectBindingsTable.uploaderId, user.userId),
      isNull(privateObjectBindingsTable.resourceType),
      isNull(privateObjectBindingsTable.resourceId),
      isNull(privateObjectBindingsTable.revokedAt),
    ))
    .returning({ id: privateObjectBindingsTable.id });

  return updated.length > 0;
}

async function canReadUserPhoto(
  targetUserId: number,
  user: Pick<JwtPayload, "userId" | "role">,
  serviceDate: string,
): Promise<boolean> {
  if (targetUserId === user.userId || isOperationalRole(user.role)) return true;

  const [target] = await db
    .select({ role: usersTable.role, primaryClassId: usersTable.primaryClassId })
    .from(usersTable)
    .where(eq(usersTable.id, targetUserId))
    .limit(1);
  if (!target) return false;
  if (["admin", "super_admin", "support"].includes(target.role)) return true;

  if (user.role === "parent") {
    const ownFamilies = await db
      .select({ id: familiesTable.id })
      .from(familiesTable)
      .where(or(
        eq(familiesTable.parent1Id, user.userId),
        eq(familiesTable.parent2Id, user.userId),
      ));
    if (ownFamilies.length === 0) return false;

    if (target.role === "parent") {
      const [sharedFamily] = await db
        .select({ id: familiesTable.id })
        .from(familiesTable)
        .where(and(
          inArray(familiesTable.id, ownFamilies.map(f => f.id)),
          or(
            eq(familiesTable.parent1Id, targetUserId),
            eq(familiesTable.parent2Id, targetUserId),
          ),
        ))
        .limit(1);
      return Boolean(sharedFamily);
    }
    if (target.role !== "teacher" || ownFamilies.length === 0) return false;

    const children = await db
      .select({ classId: childrenTable.currentClassId })
      .from(childrenTable)
      .where(inArray(childrenTable.familyId, ownFamilies.map(f => f.id)));
    const classIds = children.map(c => c.classId).filter((id): id is number => id !== null);
    if (classIds.length === 0) return false;
    if (target.primaryClassId && classIds.includes(target.primaryClassId)) return true;

    const [targetTeacher] = await db
      .select({ id: teachersTable.id })
      .from(teachersTable)
      .where(eq(teachersTable.userId, targetUserId))
      .limit(1);
    if (!targetTeacher) return false;
    const [allocation] = await db
      .select({ id: teacherAllocationsTable.id })
      .from(teacherAllocationsTable)
      .where(and(
        eq(teacherAllocationsTable.teacherId, targetTeacher.id),
        inArray(teacherAllocationsTable.classId, classIds),
      ))
      .limit(1);
    return Boolean(allocation);
  }

  if (user.role === "teacher" && target.role === "parent") {
    const targetFamilies = await db
      .select({ id: familiesTable.id })
      .from(familiesTable)
      .where(or(
        eq(familiesTable.parent1Id, targetUserId),
        eq(familiesTable.parent2Id, targetUserId),
      ));
    if (targetFamilies.length === 0) return false;
    const children = await db
      .select({ classId: childrenTable.currentClassId })
      .from(childrenTable)
      .where(inArray(childrenTable.familyId, targetFamilies.map(f => f.id)));
    const classIds = children.map(c => c.classId).filter((id): id is number => id !== null);
    if (classIds.length === 0) return false;

    for (const classId of classIds) {
      if (await canAccessClass(user, classId, serviceDate)) return true;
    }
    return false;
  }

  return false;
}

async function discoverLegacyResource(objectPath: string): Promise<{ type: ResourceType; id: number } | null> {
  const [user] = await db.select({ id: usersTable.id }).from(usersTable)
    .where(eq(usersTable.photoUrl, objectPath)).limit(1);
  if (user) return { type: "user", id: user.id };

  const [child] = await db.select({ id: childrenTable.id }).from(childrenTable)
    .where(eq(childrenTable.photoUrl, objectPath)).limit(1);
  if (child) return { type: "child", id: child.id };

  const [delegate] = await db.select({ id: pickupDelegatesTable.id }).from(pickupDelegatesTable)
    .where(eq(pickupDelegatesTable.photoUrl, objectPath)).limit(1);
  if (delegate) return { type: "pickup_delegate", id: delegate.id };

  return null;
}

export async function canReadPrivateObject(
  objectPath: string,
  user: Pick<JwtPayload, "userId" | "role">,
  serviceDate: string,
): Promise<boolean> {
  const [binding] = await db
    .select()
    .from(privateObjectBindingsTable)
    .where(eq(privateObjectBindingsTable.objectPath, objectPath))
    .limit(1);
  if (binding?.revokedAt) return false;

  const resource = binding?.resourceType && binding.resourceId
    ? { type: binding.resourceType as ResourceType, id: binding.resourceId }
    : await discoverLegacyResource(objectPath);
  if (!resource) return false;

  if (resource.type === "user") {
    return canReadUserPhoto(resource.id, user, serviceDate);
  }

  if (resource.type === "class_display") {
    // Classroom TV media (videos/images) — readable by any staff member who
    // can access the class. TVs themselves receive short-lived signed URLs.
    if (isOperationalRole(user.role)) return true;
    if (user.role !== "teacher") return false;
    return canAccessClass(user, resource.id, serviceDate);
  }

  if (resource.type === "child") {
    if (isOperationalRole(user.role)) return true;
    if (user.role === "parent") return parentOwnsChild(user.userId, resource.id);
    if (user.role !== "teacher") return false;
    const [child] = await db.select({ classId: childrenTable.currentClassId }).from(childrenTable)
      .where(eq(childrenTable.id, resource.id)).limit(1);
    return Boolean(child?.classId && await canAccessClass(user, child.classId, serviceDate));
  }

  const delegates = await db
    .select({ childId: pickupDelegatesTable.childId })
    .from(pickupDelegatesTable)
    .where(eq(pickupDelegatesTable.photoUrl, objectPath));
  if (delegates.length === 0) return false;
  if (isOperationalRole(user.role)) return true;
  if (user.role !== "parent") return false;
  for (const delegate of delegates) {
    if (await parentOwnsChild(user.userId, delegate.childId)) return true;
  }
  return false;
}