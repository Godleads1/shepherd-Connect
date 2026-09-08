export type CheckoutAccess =
  | { kind: "normal" }
  | { kind: "admin_override" }
  | { kind: "blocked"; message: string };

const NORMAL_CHECKOUT_ROLES = new Set(["super_admin", "admin", "support", "attendant"]);

export function getCheckoutAccess(
  role: string | null | undefined,
  custodyEpisodeId: number | null | undefined,
): CheckoutAccess {
  if (!custodyEpisodeId) {
    return role && NORMAL_CHECKOUT_ROLES.has(role)
      ? { kind: "normal" }
      : {
          kind: "blocked",
          message: "Your role cannot check out children. Ask Support or an administrator for help.",
        };
  }

  if (role === "support") return { kind: "normal" };
  if (role === "admin" || role === "super_admin") return { kind: "admin_override" };

  return {
    kind: "blocked",
    message: "Custody-backed children can only be released by the accepting Support custodian or by an Admin or Super Admin with a recorded reason.",
  };
}