export type RegistrationRole = "super_admin" | "admin" | "teacher" | "support" | "parent";

export function getPublicRegistrationPolicy(role: RegistrationRole) {
  if (role === "super_admin") {
    return { allowed: false, requiresApproval: false };
  }

  return {
    allowed: true,
    requiresApproval: role !== "parent",
  };
}