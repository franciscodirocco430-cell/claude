import type { memberRole } from "@/db/schema/enums";

export type Role = (typeof memberRole.enumValues)[number];

const RANK: Record<Role, number> = { setter: 0, admin: 1, owner: 2 };

export function isAdminRole(role: Role): boolean {
  return RANK[role] >= RANK.admin;
}

/** Roles que un actor puede asignar al invitar o al cambiar el rol de alguien. */
export function assignableRoles(actor: Role): Role[] {
  if (actor === "owner") return ["owner", "admin", "setter"];
  if (actor === "admin") return ["admin", "setter"];
  return [];
}

export type PermissionResult = { ok: true } | { ok: false; reason: string };

const deny = (reason: string): PermissionResult => ({ ok: false, reason });
const allow: PermissionResult = { ok: true };

export function canInvite(actor: Role, role: Role): PermissionResult {
  if (!isAdminRole(actor)) return deny("Solo owners y admins pueden invitar.");
  if (!assignableRoles(actor).includes(role)) return deny("No podés invitar con ese rol.");
  return allow;
}

export interface MemberChange {
  actorId: string;
  actorRole: Role;
  targetId: string;
  targetRole: Role;
  /** Cantidad de owners actuales de la organización. */
  ownerCount: number;
}

export function canChangeRole(change: MemberChange, newRole: Role): PermissionResult {
  const base = canManage(change);
  if (!base.ok) return base;
  if (!assignableRoles(change.actorRole).includes(newRole)) {
    return deny("No podés asignar ese rol.");
  }
  if (change.targetRole === "owner" && newRole !== "owner" && change.ownerCount <= 1) {
    return deny("La organización tiene que tener al menos un owner.");
  }
  return allow;
}

export function canRemoveMember(change: MemberChange): PermissionResult {
  const base = canManage(change);
  if (!base.ok) return base;
  if (change.targetRole === "owner" && change.ownerCount <= 1) {
    return deny("La organización tiene que tener al menos un owner.");
  }
  return allow;
}

function canManage(change: MemberChange): PermissionResult {
  if (!isAdminRole(change.actorRole))
    return deny("Solo owners y admins pueden gestionar el equipo.");
  if (change.actorId === change.targetId)
    return deny("No podés cambiar tu propio rol ni quitarte.");
  if (change.targetRole === "owner" && change.actorRole !== "owner") {
    return deny("Solo un owner puede modificar a otro owner.");
  }
  return allow;
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  setter: "Setter",
};
