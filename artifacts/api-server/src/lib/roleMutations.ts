import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

export const USER_ROLES = ["super_admin", "admin", "teacher", "support", "parent"] as const;
export type UserRole = typeof USER_ROLES[number];
export type RoleTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type UserRow = typeof usersTable.$inferSelect;

const USER_ROLE_SET = new Set<string>(USER_ROLES);

function parseCanonicalRoles(raw: string | null | undefined): UserRole[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((role): role is UserRole =>
      typeof role === "string" && USER_ROLE_SET.has(role),
    ))];
  } catch {
    return [];
  }
}

export function canonicalSecondaryRoles(
  raw: string | null | undefined,
  primaryRole: UserRole,
): UserRole[] {
  return parseCanonicalRoles(raw).filter(role => role !== primaryRole);
}

export function canonicalPendingRoles(raw: string | null | undefined): UserRole[] {
  return parseCanonicalRoles(raw);
}

export async function lockUserById(
  tx: RoleTransaction,
  userId: number,
): Promise<UserRow | undefined> {
  const [user] = await tx
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1)
    .for("update");
  return user;
}

export async function lockUserByEmail(
  tx: RoleTransaction,
  email: string,
): Promise<UserRow | undefined> {
  const [user] = await tx
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1)
    .for("update");
  return user;
}