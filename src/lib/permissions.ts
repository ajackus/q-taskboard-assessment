import type { Role } from "@/types";

export type Action =
  | "project:edit"
  | "project:delete"
  | "task:create"
  | "task:edit"
  | "task:delete"
  | "comment:create"
  | "export:run";

/**
 * Each role is a state; each action is a guarded transition that either
 * succeeds (the role may perform it) or is rejected. Centralizing the
 * table here means a role's permissions are defined in exactly one place,
 * instead of as ad hoc booleans scattered across route handlers.
 */
const PERMISSIONS: Record<Action, ReadonlySet<Role>> = {
  "project:edit": new Set(["admin"]),
  "project:delete": new Set(["admin"]),
  "task:create": new Set(["admin", "member"]),
  "task:edit": new Set(["admin", "member"]),
  "task:delete": new Set(["admin", "member"]),
  "comment:create": new Set(["admin", "member"]),
  "export:run": new Set(["admin", "member"]),
};

export function can(role: Role | null | undefined, action: Action): boolean {
  if (!role) return false;
  return PERMISSIONS[action].has(role);
}
