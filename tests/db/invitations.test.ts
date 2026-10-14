import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { invitations, memberships } from "@/db/schema";
import {
  acceptInvitation,
  createInvitation,
  findInvitationByToken,
  listPendingInvitations,
  revokeInvitation,
} from "@/server/invitations/service";
import { createOrganization } from "@/server/organizations/service";
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from "./setup";

describe.skipIf(!TEST_DATABASE_URL)("invitaciones", () => {
  let t: TestDatabase;
  let orgId: string;
  let owner: string;

  async function createUser(email: string) {
    const id = randomUUID();
    await t.db.execute(sql`insert into auth.users (id, email) values (${id}, ${email})`);
    return id;
  }

  beforeAll(async () => {
    t = await createTestDatabase();
    owner = await createUser(`owner-${randomUUID()}@example.com`);
    orgId = (await createOrganization(t.db, { userId: owner, name: "Org invitaciones" })).id;
  });
  afterAll(async () => {
    await t?.drop();
  });

  it("guarda solo el hash del token", async () => {
    const { invitation, token } = await createInvitation(t.db, {
      actorId: owner,
      organizationId: orgId,
      email: "Hash@Example.com",
      role: "setter",
    });
    expect(invitation.email).toBe("hash@example.com");
    expect(invitation.tokenHash).not.toBe(token);
    const raw = await t.db.execute(sql`select * from invitations where id = ${invitation.id}`);
    expect(JSON.stringify(raw)).not.toContain(token);
  });

  it("acepta con el email correcto y crea la membresía con el rol invitado", async () => {
    const email = `nuevo-${randomUUID()}@example.com`;
    const { token } = await createInvitation(t.db, {
      actorId: owner,
      organizationId: orgId,
      email,
      role: "admin",
    });
    const userId = await createUser(email);
    const res = await acceptInvitation(t.db, { token, userId, userEmail: email.toUpperCase() });
    expect(res.organizationId).toBe(orgId);
    const [m] = await t.db.select().from(memberships).where(eq(memberships.userId, userId));
    expect(m?.role).toBe("admin");
    expect((await findInvitationByToken(t.db, token))?.status).toBe("accepted");
  });

  it("rechaza otra cuenta aunque tenga el link", async () => {
    const { token } = await createInvitation(t.db, {
      actorId: owner,
      organizationId: orgId,
      email: `destino-${randomUUID()}@example.com`,
      role: "setter",
    });
    const intruder = await createUser(`intruso-${randomUUID()}@example.com`);
    await expect(
      acceptInvitation(t.db, { token, userId: intruder, userEmail: "intruso@example.com" }),
    ).rejects.toThrow(/Esta invitación es para/);
  });

  it("no se puede reutilizar", async () => {
    const email = `reuso-${randomUUID()}@example.com`;
    const { token } = await createInvitation(t.db, {
      actorId: owner,
      organizationId: orgId,
      email,
      role: "setter",
    });
    const userId = await createUser(email);
    await acceptInvitation(t.db, { token, userId, userEmail: email });
    await expect(acceptInvitation(t.db, { token, userId, userEmail: email })).rejects.toThrow(
      /ya fue usada/,
    );
  });

  it("vence a los 7 días", async () => {
    const email = `vence-${randomUUID()}@example.com`;
    const now = new Date();
    const { token } = await createInvitation(t.db, {
      actorId: owner,
      organizationId: orgId,
      email,
      role: "setter",
      now,
    });
    const userId = await createUser(email);
    const later = new Date(now.getTime() + 7 * 24 * 3600 * 1000 + 1);
    await expect(
      acceptInvitation(t.db, { token, userId, userEmail: email, now: later }),
    ).rejects.toThrow(/venció/);
  });

  it("revocada no sirve y reinvitar reemplaza la anterior", async () => {
    const email = `revoca-${randomUUID()}@example.com`;
    const first = await createInvitation(t.db, {
      actorId: owner,
      organizationId: orgId,
      email,
      role: "setter",
    });
    const second = await createInvitation(t.db, {
      actorId: owner,
      organizationId: orgId,
      email,
      role: "admin",
    });
    expect((await findInvitationByToken(t.db, first.token))?.status).toBe("revoked");
    await revokeInvitation(t.db, {
      actorId: owner,
      organizationId: orgId,
      invitationId: second.invitation.id,
    });
    expect((await findInvitationByToken(t.db, second.token))?.status).toBe("revoked");
    const pending = await listPendingInvitations(t.db, orgId);
    expect(pending.find((p) => p.email === email)).toBeUndefined();
  });

  it("un setter no puede invitar y un admin no puede invitar owners", async () => {
    const setterEmail = `setter-${randomUUID()}@example.com`;
    const { token } = await createInvitation(t.db, {
      actorId: owner,
      organizationId: orgId,
      email: setterEmail,
      role: "setter",
    });
    const setter = await createUser(setterEmail);
    await acceptInvitation(t.db, { token, userId: setter, userEmail: setterEmail });
    await expect(
      createInvitation(t.db, {
        actorId: setter,
        organizationId: orgId,
        email: "x@example.com",
        role: "setter",
      }),
    ).rejects.toThrow(/Solo owners y admins/);

    const adminEmail = `admin-${randomUUID()}@example.com`;
    const inv = await createInvitation(t.db, {
      actorId: owner,
      organizationId: orgId,
      email: adminEmail,
      role: "admin",
    });
    const admin = await createUser(adminEmail);
    await acceptInvitation(t.db, { token: inv.token, userId: admin, userEmail: adminEmail });
    await expect(
      createInvitation(t.db, {
        actorId: admin,
        organizationId: orgId,
        email: "y@example.com",
        role: "owner",
      }),
    ).rejects.toThrow(/rol/);
  });

  it("no invita a quien ya es miembro", async () => {
    const [ownerRow] = await t.db.execute<{ email: string }>(
      sql`select email from auth.users where id = ${owner}`,
    );
    await expect(
      createInvitation(t.db, {
        actorId: owner,
        organizationId: orgId,
        email: ownerRow!.email,
        role: "setter",
      }),
    ).rejects.toThrow(/ya es parte/);
  });

  it("alguien de otra organización no puede invitar acá", async () => {
    const outsider = await createUser(`fuera-${randomUUID()}@example.com`);
    await createOrganization(t.db, { userId: outsider, name: "Ajena" });
    await expect(
      createInvitation(t.db, {
        actorId: outsider,
        organizationId: orgId,
        email: "z@example.com",
        role: "setter",
      }),
    ).rejects.toThrow(/No pertenecés/);
    const before = await t.db
      .select()
      .from(invitations)
      .where(eq(invitations.email, "z@example.com"));
    expect(before).toHaveLength(0);
  });
});
