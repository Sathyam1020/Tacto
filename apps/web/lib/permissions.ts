import type { WorkspaceRole } from "@workspace/contracts/settings"

/**
 * Workspace permission model — the single source of truth for who-can-do-what,
 * used to hide/disable UI. The server (better-auth) is the real enforcer; this
 * keeps the interface honest. Roles: owner > admin > member.
 */
export type WorkspaceAction =
  | "workspace:edit" // name, slug, logo
  | "workspace:delete"
  | "member:invite"
  | "member:role"
  | "member:remove"

const RANK: Record<WorkspaceRole, number> = { member: 0, admin: 1, owner: 2 }

export function can(role: WorkspaceRole | undefined | null, action: WorkspaceAction): boolean {
  if (!role) return false
  switch (action) {
    case "workspace:edit":
    case "member:invite":
    case "member:role":
    case "member:remove":
      return RANK[role] >= RANK.admin
    case "workspace:delete":
      return role === "owner"
    default:
      return false
  }
}

/** Normalize an arbitrary role string (better-auth stores free-form) to a known role. */
export function asRole(role: string | null | undefined): WorkspaceRole {
  return role === "owner" || role === "admin" ? role : "member"
}
