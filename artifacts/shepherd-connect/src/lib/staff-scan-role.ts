export type StaffScanRole = "teacher" | "support" | "admin" | "super_admin";

const STAFF_SCAN_ROLES: readonly StaffScanRole[] = [
  "teacher",
  "support",
  "admin",
  "super_admin",
];

function isStaffScanRole(value: unknown): value is StaffScanRole {
  return typeof value === "string" &&
    STAFF_SCAN_ROLES.includes(value as StaffScanRole);
}

export function resolveStaffScanRole(user: unknown): StaffScanRole | null {
  if (!user || typeof user !== "object") return null;

  const roleState = user as {
    role?: unknown;
    allRoles?: unknown;
    secondaryRoles?: unknown;
  };

  if (isStaffScanRole(roleState.role)) return roleState.role;

  const approvedRoles = [
    ...(Array.isArray(roleState.allRoles) ? roleState.allRoles : []),
    ...(Array.isArray(roleState.secondaryRoles) ? roleState.secondaryRoles : []),
  ];

  return approvedRoles.includes("teacher") ? "teacher" : null;
}