import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { memberships, pipelineStages, profiles } from "@/db/schema";
import { DomainError } from "@/server/errors";
import {
  changeMemberRole,
  countOwners,
  createOrganization,
  listMembers,
  listUserOrganizations,
  removeMember,
} from "@/server/organizations/service";
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from "./setup";

async function createUser(t: TestDatabase, email: string, fullName?: string) {
  const id = randomUUID();
  await t.db.execute(sql`insert into auth.users (id, email, raw_user_meta_data)
    values (${id}, ${email}, ${JSON.stringify(fullName ? { full_name: fullName } : {})}::jsonb)`);
  return id;
}

async function addMember(
  t: TestDatabase,
  organizationId: string,
  userId: string,
  role: "owner" | "admin" | "setter",
) {
  const [m] = await t.db.insert(memberships).values({ organizationId, userId, role }).returning();
  return m!;
}

describe.skipIf(!TEST_DATABASE_URL)("organizaciones", () => {
  let t: TestDatabase;

  beforeAll(async () => {
    t = await createTestDatabase();
  });
  afterAll(async () => {
    await t?.drop();
  });

  it("crear una organización deja al usuario como owner con el pipeline por defecto", async () => {
    const userId = await createUser(t, `o-${randomUUID()}@example.com`);
    const org = await createOrganization(t.db, { userId, name: "Agencia Ñandú" });
    expect(org.slug).toBe("agencia-nandu");

    const orgs = await listUserOrganizations(t.db, userId);
    expect(orgs).toEqual([
      { organizationId: org.id, name: "Agencia Ñandú", slug: "agencia-nandu", role: "owner" },
    ]);

    const stages = await t.db
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.organizationId, org.id));
    expect(stages.map((s) => s.key).sort()).toEqual([
      "agendado",
      "calificado",
      "contactado",
      "ganado",
      "nuevo",
      "perdido",
      "respondio",
    ]);
  });

  it("resuelve colisiones de slug", async () => {
    const u1 = await createUser(t, `c1-${randomUUID()}@example.com`);
    const u2 = await createUser(t, `c2-${randomUUID()}@example.com`);
    const a = await createOrganization(t.db, { userId: u1, name: "Mismo Nombre" });
    const b = await createOrganization(t.db, { userId: u2, name: "Mismo Nombre" });
    expect(a.slug).toBe("mismo-nombre");
    expect(b.slug).toMatch(/^mismo-nombre-[0-9a-f]{6}$/);
  });

  it("el perfil se sincroniza desde auth.users", async () => {
    const email = `Perfil-${randomUUID()}@Example.com`;
    const id = await createUser(t, email, "Laura Gómez");
    const [p] = await t.db.select().from(profiles).where(eq(profiles.id, id));
    expect(p).toMatchObject({ email: email.toLowerCase(), fullName: "Laura Gómez" });
  });

  describe("gestión del equipo", () => {
    let orgId: string;
    let owner: string;
    let admin: string;
    let setter: string;
    let adminM: string;
    let setterM: string;
    let ownerM: string;

    beforeAll(async () => {
      owner = await createUser(t, `owner-${randomUUID()}@example.com`);
      admin = await createUser(t, `admin-${randomUUID()}@example.com`);
      setter = await createUser(t, `setter-${randomUUID()}@example.com`);
      const org = await createOrganization(t.db, { userId: owner, name: "Equipo" });
      orgId = org.id;
      ownerM = (await t.db.select().from(memberships).where(eq(memberships.userId, owner)))[0]!.id;
      adminM = (await addMember(t, orgId, admin, "admin")).id;
      setterM = (await addMember(t, orgId, setter, "setter")).id;
    });

    it("lista miembros con email", async () => {
      const members = await listMembers(t.db, orgId);
      expect(members).toHaveLength(3);
      expect(members.every((m) => m.email?.endsWith("@example.com"))).toBe(true);
    });

    it("un setter no puede cambiar roles", async () => {
      await expect(
        changeMemberRole(t.db, {
          actorId: setter,
          organizationId: orgId,
          membershipId: adminM,
          role: "setter",
        }),
      ).rejects.toBeInstanceOf(DomainError);
    });

    it("un admin no puede tocar al owner ni promover a owner", async () => {
      await expect(
        changeMemberRole(t.db, {
          actorId: admin,
          organizationId: orgId,
          membershipId: ownerM,
          role: "admin",
        }),
      ).rejects.toThrow(/owner/);
      await expect(
        changeMemberRole(t.db, {
          actorId: admin,
          organizationId: orgId,
          membershipId: setterM,
          role: "owner",
        }),
      ).rejects.toThrow(/rol/);
    });

    it("el último owner no puede degradarse ni ser quitado", async () => {
      await expect(
        removeMember(t.db, { actorId: owner, organizationId: orgId, membershipId: ownerM }),
      ).rejects.toThrow();
      expect(await countOwners(t.db, orgId)).toBe(1);
    });

    it("no se puede operar sobre membresías de otra organización", async () => {
      const outsider = await createUser(t, `out-${randomUUID()}@example.com`);
      const other = await createOrganization(t.db, { userId: outsider, name: "Otra" });
      const [outsiderM] = await t.db
        .select()
        .from(memberships)
        .where(eq(memberships.organizationId, other.id));
      await expect(
        removeMember(t.db, { actorId: owner, organizationId: orgId, membershipId: outsiderM!.id }),
      ).rejects.toThrow(/no existe/);
    });

    it("el owner promueve y quita miembros", async () => {
      await changeMemberRole(t.db, {
        actorId: owner,
        organizationId: orgId,
        membershipId: setterM,
        role: "admin",
      });
      await removeMember(t.db, { actorId: owner, organizationId: orgId, membershipId: setterM });
      const members = await listMembers(t.db, orgId);
      expect(members.map((m) => m.userId).sort()).toEqual([owner, admin].sort());
    });

    it("dos owners degradándose a la vez no dejan la org sin owner", async () => {
      const second = await createUser(t, `owner2-${randomUUID()}@example.com`);
      const secondM = (await addMember(t, orgId, second, "owner")).id;
      const results = await Promise.allSettled([
        changeMemberRole(t.db, {
          actorId: owner,
          organizationId: orgId,
          membershipId: secondM,
          role: "admin",
        }),
        changeMemberRole(t.db, {
          actorId: second,
          organizationId: orgId,
          membershipId: ownerM,
          role: "admin",
        }),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await countOwners(t.db, orgId)).toBe(1);
    });
  });
});
