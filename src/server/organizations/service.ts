import { randomBytes } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import type { DbExecutor } from "@/db/rls";
import { memberships, organizations, pipelineStages, profiles } from "@/db/schema";
import { canChangeRole, canRemoveMember, type Role } from "@/server/auth/permissions";
import { DomainError } from "@/server/errors";
import { DEFAULT_PIPELINE_STAGES } from "@/server/pipeline/default-stages";
import { slugify } from "./slug";

export type Organization = typeof organizations.$inferSelect;

/**
 * Crea una organización con su owner y las etapas de pipeline por defecto.
 * Se ejecuta con privilegios de servidor: `userId` tiene que venir de una
 * sesión verificada, nunca del cliente.
 */
export async function createOrganization(
  db: Database,
  input: { userId: string; name: string },
): Promise<Organization> {
  return db.transaction(async (tx) => {
    const base = slugify(input.name);
    let org: Organization | undefined;
    for (let attempt = 0; attempt < 5 && !org; attempt++) {
      const slug = attempt === 0 ? base : `${base}-${randomBytes(3).toString("hex")}`;
      [org] = await tx
        .insert(organizations)
        .values({ name: input.name.trim(), slug })
        .onConflictDoNothing({ target: organizations.slug })
        .returning();
    }
    if (!org)
      throw new DomainError("slug_taken", "No pudimos crear la organización. Probá otro nombre.");

    await tx
      .insert(memberships)
      .values({ organizationId: org.id, userId: input.userId, role: "owner" });
    await tx
      .insert(pipelineStages)
      .values(DEFAULT_PIPELINE_STAGES.map((s) => ({ ...s, organizationId: org.id })));
    return org;
  });
}

export interface UserOrganization {
  organizationId: string;
  name: string;
  slug: string;
  role: Role;
}

export async function listUserOrganizations(
  db: Database,
  userId: string,
): Promise<UserOrganization[]> {
  return db
    .select({
      organizationId: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(eq(memberships.userId, userId))
    .orderBy(asc(memberships.createdAt));
}

export interface Member {
  membershipId: string;
  userId: string;
  role: Role;
  email: string | null;
  fullName: string | null;
  joinedAt: Date;
}

export async function listMembers(db: DbExecutor, organizationId: string): Promise<Member[]> {
  return db
    .select({
      membershipId: memberships.id,
      userId: memberships.userId,
      role: memberships.role,
      email: profiles.email,
      fullName: profiles.fullName,
      joinedAt: memberships.createdAt,
    })
    .from(memberships)
    .leftJoin(profiles, eq(profiles.id, memberships.userId))
    .where(eq(memberships.organizationId, organizationId))
    .orderBy(asc(memberships.createdAt));
}

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Bloquea las membresías de la org para que dos cambios simultáneos no dejen 0 owners. */
async function loadForChange(
  tx: Tx,
  input: { actorId: string; organizationId: string; membershipId: string },
) {
  const rows = await tx
    .select()
    .from(memberships)
    .where(eq(memberships.organizationId, input.organizationId))
    .for("update");
  const actor = rows.find((m) => m.userId === input.actorId);
  const target = rows.find((m) => m.id === input.membershipId);
  if (!actor) throw new DomainError("forbidden", "No pertenecés a esta organización.");
  if (!target) throw new DomainError("not_found", "Ese miembro ya no existe.");
  return {
    target,
    change: {
      actorId: actor.userId,
      actorRole: actor.role,
      targetId: target.userId,
      targetRole: target.role,
      ownerCount: rows.filter((m) => m.role === "owner").length,
    },
  };
}

export async function changeMemberRole(
  db: Database,
  input: { actorId: string; organizationId: string; membershipId: string; role: Role },
) {
  await db.transaction(async (tx) => {
    const { target, change } = await loadForChange(tx, input);
    const check = canChangeRole(change, input.role);
    if (!check.ok) throw new DomainError("forbidden", check.reason);
    await tx
      .update(memberships)
      .set({ role: input.role })
      .where(
        and(eq(memberships.id, target.id), eq(memberships.organizationId, input.organizationId)),
      );
  });
}

export async function removeMember(
  db: Database,
  input: { actorId: string; organizationId: string; membershipId: string },
) {
  await db.transaction(async (tx) => {
    const { target, change } = await loadForChange(tx, input);
    const check = canRemoveMember(change);
    if (!check.ok) throw new DomainError("forbidden", check.reason);
    await tx
      .delete(memberships)
      .where(
        and(eq(memberships.id, target.id), eq(memberships.organizationId, input.organizationId)),
      );
  });
}

export async function getMembership(db: Database, userId: string, organizationId: string) {
  const [row] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.organizationId, organizationId)));
  return row ?? null;
}

/** Usado por tests y diagnósticos. */
export async function countOwners(db: Database, organizationId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(memberships)
    .where(and(eq(memberships.organizationId, organizationId), eq(memberships.role, "owner")));
  return row?.n ?? 0;
}
