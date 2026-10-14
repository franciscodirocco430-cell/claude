import { and, desc, eq, gt, isNull } from "drizzle-orm";
import type { Database } from "@/db/client";
import type { DbExecutor } from "@/db/rls";
import { invitations, memberships, organizations, profiles } from "@/db/schema";
import { canInvite, type Role } from "@/server/auth/permissions";
import { DomainError } from "@/server/errors";
import {
  generateInvitationToken,
  hashInvitationToken,
  INVITATION_TTL_DAYS,
  normalizeEmail,
} from "./token";

export type Invitation = typeof invitations.$inferSelect;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Crea una invitación y devuelve el token en claro (solo esta vez: en la base
 * queda el hash). Si ya había una pendiente para ese email, la reemplaza.
 */
export async function createInvitation(
  db: Database,
  input: { actorId: string; organizationId: string; email: string; role: Role; now?: Date },
): Promise<{ invitation: Invitation; token: string }> {
  const now = input.now ?? new Date();
  const email = normalizeEmail(input.email);

  return db.transaction(async (tx) => {
    const [actor] = await tx
      .select({ role: memberships.role })
      .from(memberships)
      .where(
        and(
          eq(memberships.organizationId, input.organizationId),
          eq(memberships.userId, input.actorId),
        ),
      );
    if (!actor) throw new DomainError("forbidden", "No pertenecés a esta organización.");
    const check = canInvite(actor.role, input.role);
    if (!check.ok) throw new DomainError("forbidden", check.reason);

    const [existingMember] = await tx
      .select({ id: memberships.id })
      .from(memberships)
      .innerJoin(profiles, eq(profiles.id, memberships.userId))
      .where(and(eq(memberships.organizationId, input.organizationId), eq(profiles.email, email)));
    if (existingMember)
      throw new DomainError("already_member", "Esa persona ya es parte del equipo.");

    await tx
      .update(invitations)
      .set({ revokedAt: now })
      .where(
        and(
          eq(invitations.organizationId, input.organizationId),
          eq(invitations.email, email),
          isNull(invitations.acceptedAt),
          isNull(invitations.revokedAt),
        ),
      );

    const token = generateInvitationToken();
    const [invitation] = await tx
      .insert(invitations)
      .values({
        organizationId: input.organizationId,
        email,
        role: input.role,
        tokenHash: hashInvitationToken(token),
        invitedBy: input.actorId,
        expiresAt: new Date(now.getTime() + INVITATION_TTL_DAYS * DAY_MS),
      })
      .returning();
    return { invitation: invitation!, token };
  });
}

export async function listPendingInvitations(
  db: DbExecutor,
  organizationId: string,
  now = new Date(),
) {
  return db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      expiresAt: invitations.expiresAt,
      createdAt: invitations.createdAt,
    })
    .from(invitations)
    .where(
      and(
        eq(invitations.organizationId, organizationId),
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt),
        gt(invitations.expiresAt, now),
      ),
    )
    .orderBy(desc(invitations.createdAt));
}

export async function revokeInvitation(
  db: Database,
  input: { actorId: string; organizationId: string; invitationId: string; now?: Date },
) {
  const [actor] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(
      and(
        eq(memberships.organizationId, input.organizationId),
        eq(memberships.userId, input.actorId),
      ),
    );
  if (!actor || actor.role === "setter") {
    throw new DomainError("forbidden", "Solo owners y admins pueden revocar invitaciones.");
  }
  await db
    .update(invitations)
    .set({ revokedAt: input.now ?? new Date() })
    .where(
      and(
        eq(invitations.id, input.invitationId),
        eq(invitations.organizationId, input.organizationId),
        isNull(invitations.acceptedAt),
      ),
    );
}

export type InvitationStatus = "valid" | "expired" | "accepted" | "revoked";

export function invitationStatus(inv: Invitation, now = new Date()): InvitationStatus {
  if (inv.acceptedAt) return "accepted";
  if (inv.revokedAt) return "revoked";
  if (inv.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}

export async function findInvitationByToken(db: Database, token: string, now = new Date()) {
  const [row] = await db
    .select({ invitation: invitations, organizationName: organizations.name })
    .from(invitations)
    .innerJoin(organizations, eq(organizations.id, invitations.organizationId))
    .where(eq(invitations.tokenHash, hashInvitationToken(token)));
  if (!row) return null;
  return { ...row, status: invitationStatus(row.invitation, now) };
}

const STATUS_ERRORS: Record<Exclude<InvitationStatus, "valid">, string> = {
  expired: "La invitación venció. Pedile a quien te invitó que te mande una nueva.",
  accepted: "Esta invitación ya fue usada.",
  revoked: "Esta invitación fue cancelada.",
};

/**
 * Acepta una invitación. El email de la sesión tiene que coincidir con el
 * invitado: un link reenviado no le da acceso a otra persona.
 */
export async function acceptInvitation(
  db: Database,
  input: { token: string; userId: string; userEmail: string | null | undefined; now?: Date },
): Promise<{ organizationId: string }> {
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    const [inv] = await tx
      .select()
      .from(invitations)
      .where(eq(invitations.tokenHash, hashInvitationToken(input.token)))
      .for("update");
    if (!inv) throw new DomainError("not_found", "La invitación no existe.");

    const status = invitationStatus(inv, now);
    if (status !== "valid") throw new DomainError(status, STATUS_ERRORS[status]);

    if (!input.userEmail || normalizeEmail(input.userEmail) !== inv.email) {
      throw new DomainError(
        "email_mismatch",
        `Esta invitación es para ${inv.email}. Entrá con esa cuenta para aceptarla.`,
      );
    }

    await tx
      .insert(memberships)
      .values({ organizationId: inv.organizationId, userId: input.userId, role: inv.role })
      .onConflictDoNothing({ target: [memberships.organizationId, memberships.userId] });
    await tx
      .update(invitations)
      .set({ acceptedAt: now, acceptedBy: input.userId })
      .where(eq(invitations.id, inv.id));
    return { organizationId: inv.organizationId };
  });
}
