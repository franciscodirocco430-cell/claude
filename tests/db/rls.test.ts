import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withUserContext } from "@/db/rls";
import * as s from "@/db/schema";
import { createOrgFixture, type OrgFixture } from "./fixtures";
import { createTestDatabase, dbErrorMessage, TEST_DATABASE_URL, type TestDatabase } from "./setup";

const RLS_DENIED = /row-level security/;

/** Tablas sin políticas a propósito: solo las toca el servidor. */
const SERVER_ONLY_TABLES = ["connected_account_secrets", "jobs"];

describe.skipIf(!TEST_DATABASE_URL)("RLS multi-tenant", () => {
  let t: TestDatabase;
  let a: OrgFixture;
  let b: OrgFixture;
  let tenantTables: string[];

  beforeAll(async () => {
    t = await createTestDatabase();
    a = await createOrgFixture(t.db, "a");
    b = await createOrgFixture(t.db, "b");
    const rows = await t.db.execute<{ table_name: string }>(sql`
      select table_name from information_schema.columns
      where table_schema = 'public' and column_name = 'organization_id'
      order by table_name`);
    tenantTables = rows.map((r) => r.table_name);
  });

  afterAll(async () => {
    await t?.drop();
  });

  it("todas las tablas de public tienen RLS activo", async () => {
    const rows = await t.db.execute<{ relname: string }>(sql`
      select c.relname from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  it("toda tabla con datos de clientes tiene políticas, salvo las de solo servidor", async () => {
    const rows = await t.db.execute<{ tablename: string }>(sql`
      select distinct tablename from pg_policies where schemaname = 'public'`);
    const withPolicies = new Set(rows.map((r) => r.tablename));
    for (const table of [...tenantTables, "organizations", "profiles"]) {
      if (SERVER_ONLY_TABLES.includes(table)) {
        expect(withPolicies.has(table), `${table} no debería tener políticas`).toBe(false);
      } else {
        expect(withPolicies.has(table), `${table} no tiene políticas`).toBe(true);
      }
    }
  });

  it("toda tabla con updated_at tiene el trigger set_updated_at", async () => {
    const rows = await t.db.execute<{ table_name: string }>(sql`
      select c.table_name from information_schema.columns c
      where c.table_schema = 'public' and c.column_name = 'updated_at'
        and not exists (
          select 1 from information_schema.triggers tr
          where tr.event_object_schema = 'public'
            and tr.event_object_table = c.table_name
            and tr.trigger_name = 'set_updated_at'
        )`);
    expect(rows.map((r) => r.table_name)).toEqual([]);
  });

  it("un usuario solo ve filas de su organización en cada tabla", async () => {
    await withUserContext(t.db, { sub: a.ownerId }, async (tx) => {
      for (const table of tenantTables) {
        const rows = await tx.execute<{ organization_id: string }>(
          sql`select distinct organization_id from ${sql.identifier(table)}`,
        );
        const orgs = rows.map((r) => r.organization_id);
        if (SERVER_ONLY_TABLES.includes(table)) {
          expect(orgs, table).toEqual([]);
        } else {
          expect(orgs, table).toEqual([a.orgId]);
        }
      }
      const orgs = await tx.select({ id: s.organizations.id }).from(s.organizations);
      expect(orgs).toEqual([{ id: a.orgId }]);
    });
  });

  it("sin sesión (anon) no se ve nada", async () => {
    await t.db.transaction(async (tx) => {
      await tx.execute(sql`set local role anon`);
      for (const table of [...tenantTables, "organizations"]) {
        const rows = await tx.execute(sql`select 1 from ${sql.identifier(table)}`);
        expect(rows.length, table).toBe(0);
      }
    });
  });

  it("no se pueden insertar filas en otra organización", async () => {
    const error = await dbErrorMessage(
      withUserContext(t.db, { sub: a.ownerId }, (tx) =>
        tx.insert(s.prospects).values({ organizationId: b.orgId, fullName: "intruso" }),
      ),
    );
    expect(error).toMatch(RLS_DENIED);
  });

  it("no se pueden modificar ni borrar filas de otra organización", async () => {
    await withUserContext(t.db, { sub: a.ownerId }, async (tx) => {
      const updated = await tx
        .update(s.prospects)
        .set({ notes: "pisado" })
        .where(eq(s.prospects.id, b.prospectId))
        .returning();
      expect(updated).toEqual([]);
      const deleted = await tx
        .delete(s.campaigns)
        .where(eq(s.campaigns.id, b.campaignId))
        .returning();
      expect(deleted).toEqual([]);
    });
    const [still] = await t.db
      .select({ notes: s.prospects.notes })
      .from(s.prospects)
      .where(eq(s.prospects.id, b.prospectId));
    expect(still?.notes).toBeNull();
  });

  it("no se puede mover una fila propia a otra organización", async () => {
    const error = await dbErrorMessage(
      withUserContext(t.db, { sub: a.ownerId }, (tx) =>
        tx
          .update(s.prospects)
          .set({ organizationId: b.orgId })
          .where(eq(s.prospects.id, a.prospectId)),
      ),
    );
    expect(error).toMatch(RLS_DENIED);
  });

  it("las FKs compuestas impiden referenciar datos de otra organización", async () => {
    const error = await dbErrorMessage(
      t.db.insert(s.prospectHandles).values({
        organizationId: a.orgId,
        prospectId: b.prospectId,
        channel: "instagram",
        handle: "cruzado",
      }),
    );
    expect(error).toMatch(/foreign key/);
  });

  it("un setter no puede crear campañas; un owner sí", async () => {
    const values = { organizationId: a.orgId, name: "x", niche: "n", offer: "o", icp: "i" };
    const error = await dbErrorMessage(
      withUserContext(t.db, { sub: a.setterId }, (tx) => tx.insert(s.campaigns).values(values)),
    );
    expect(error).toMatch(RLS_DENIED);
    await withUserContext(t.db, { sub: a.ownerId }, (tx) => tx.insert(s.campaigns).values(values));
  });

  it("un setter puede trabajar prospectos pero no borrarlos", async () => {
    await withUserContext(t.db, { sub: a.setterId }, async (tx) => {
      const updated = await tx
        .update(s.prospects)
        .set({ notes: "llamar el lunes" })
        .where(eq(s.prospects.id, a.prospectId))
        .returning({ id: s.prospects.id });
      expect(updated).toHaveLength(1);
      const deleted = await tx
        .delete(s.prospects)
        .where(eq(s.prospects.id, a.prospectId))
        .returning();
      expect(deleted).toEqual([]);
    });
  });

  it("nadie puede auto-asignarse membresías ni cambiarse el rol desde el cliente", async () => {
    const error = await dbErrorMessage(
      withUserContext(t.db, { sub: a.ownerId }, (tx) =>
        tx
          .insert(s.memberships)
          .values({ organizationId: b.orgId, userId: a.ownerId, role: "owner" }),
      ),
    );
    expect(error).toMatch(RLS_DENIED);

    const updated = await withUserContext(t.db, { sub: a.setterId }, (tx) =>
      tx
        .update(s.memberships)
        .set({ role: "owner" })
        .where(eq(s.memberships.userId, a.setterId))
        .returning(),
    );
    expect(updated).toEqual([]);
  });

  it("perfiles: cada uno ve el suyo y el de sus compañeros, nadie los modifica", async () => {
    await withUserContext(t.db, { sub: a.setterId }, async (tx) => {
      const rows = await tx.select({ id: s.profiles.id }).from(s.profiles);
      expect(rows.map((r) => r.id).sort()).toEqual([a.ownerId, a.setterId].sort());
      const updated = await tx
        .update(s.profiles)
        .set({ email: "falso@example.com" })
        .where(eq(s.profiles.id, a.setterId))
        .returning();
      expect(updated).toEqual([]);
    });
  });

  it("invitaciones: solo owners y admins de la org las ven; nadie las crea desde el cliente", async () => {
    await t.db.insert(s.invitations).values({
      organizationId: a.orgId,
      email: "invitada@example.com",
      tokenHash: `hash-${a.orgId}`,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    const asOwner = await withUserContext(t.db, { sub: a.ownerId }, (tx) =>
      tx.select().from(s.invitations),
    );
    expect(asOwner.map((i) => i.email).sort()).toEqual([
      "invitada@example.com",
      "pendiente-a@example.com",
    ]);
    const asSetter = await withUserContext(t.db, { sub: a.setterId }, (tx) =>
      tx.select().from(s.invitations),
    );
    expect(asSetter).toEqual([]);
    const asOtherOrg = await withUserContext(t.db, { sub: b.ownerId }, (tx) =>
      tx.select().from(s.invitations),
    );
    expect(asOtherOrg.filter((i) => i.organizationId === a.orgId)).toEqual([]);
    const error = await dbErrorMessage(
      withUserContext(t.db, { sub: a.ownerId }, (tx) =>
        tx.insert(s.invitations).values({
          organizationId: a.orgId,
          email: "x@example.com",
          tokenHash: "x",
          expiresAt: new Date(),
        }),
      ),
    );
    expect(error).toMatch(RLS_DENIED);
  });

  it("ai_runs es de solo lectura para los usuarios", async () => {
    const error = await dbErrorMessage(
      withUserContext(t.db, { sub: a.ownerId }, (tx) =>
        tx.insert(s.aiRuns).values({ organizationId: a.orgId, type: "draft", model: "x" }),
      ),
    );
    expect(error).toMatch(RLS_DENIED);
  });
});
