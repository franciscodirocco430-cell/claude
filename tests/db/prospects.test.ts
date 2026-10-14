import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withUserContext } from "@/db/rls";
import { prospectHandles, prospects, suppressionList } from "@/db/schema";
import {
  changeCampaignStatus,
  createCampaign,
  listCampaignProspects,
  listCampaigns,
} from "@/server/campaigns/service";
import { campaignInputSchema, emptyCampaign } from "@/server/campaigns/schemas";
import { createOrganization } from "@/server/organizations/service";
import { ingestProspects } from "@/server/prospects/ingest";
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from "./setup";

const campaignData = campaignInputSchema.parse({
  ...emptyCampaign(),
  name: "Campaña test",
  niche: "Clínicas dentales",
  offer: "Oferta de prueba larga",
  icp: "Clínicas medianas de CABA",
  qualificationCriteria: [{ label: "Presupuesto", weight: 50 }],
  qualificationQuestions: ["¿Cuántos pacientes?"],
  channels: ["instagram", "email"],
});

describe.skipIf(!TEST_DATABASE_URL)("campañas y prospectos", () => {
  let t: TestDatabase;
  let orgA: string;
  let orgB: string;
  let ownerA: string;
  let setterA: string;
  let ownerB: string;
  let campaignA: string;
  let campaignB: string;

  async function user(email: string) {
    const id = randomUUID();
    await t.db.execute(sql`insert into auth.users (id, email) values (${id}, ${email})`);
    return id;
  }

  const asOwnerA = <T>(fn: Parameters<typeof withUserContext<T>>[2]) =>
    withUserContext(t.db, { sub: ownerA }, fn);

  beforeAll(async () => {
    t = await createTestDatabase();
    ownerA = await user(`a-${randomUUID()}@example.com`);
    setterA = await user(`sa-${randomUUID()}@example.com`);
    ownerB = await user(`b-${randomUUID()}@example.com`);
    orgA = (await createOrganization(t.db, { userId: ownerA, name: "Org A" })).id;
    orgB = (await createOrganization(t.db, { userId: ownerB, name: "Org B" })).id;
    await t.db.execute(
      sql`insert into memberships (organization_id, user_id, role) values (${orgA}, ${setterA}, 'setter')`,
    );
    campaignA = (
      await asOwnerA((tx) =>
        createCampaign(tx, {
          organizationId: orgA,
          actorId: ownerA,
          actorRole: "owner",
          data: campaignData,
        }),
      )
    ).id;
    campaignB = (
      await withUserContext(t.db, { sub: ownerB }, (tx) =>
        createCampaign(tx, {
          organizationId: orgB,
          actorId: ownerB,
          actorRole: "owner",
          data: campaignData,
        }),
      )
    ).id;
  });
  afterAll(async () => {
    await t?.drop();
  });

  it("un setter no puede crear campañas (servicio y RLS)", async () => {
    await expect(
      withUserContext(t.db, { sub: setterA }, (tx) =>
        createCampaign(tx, {
          organizationId: orgA,
          actorId: setterA,
          actorRole: "setter",
          data: campaignData,
        }),
      ),
    ).rejects.toThrow(/Solo owners y admins/);
    // Aunque mienta sobre su rol, RLS lo frena.
    await expect(
      withUserContext(t.db, { sub: setterA }, (tx) =>
        createCampaign(tx, {
          organizationId: orgA,
          actorId: setterA,
          actorRole: "owner",
          data: campaignData,
        }),
      ),
    ).rejects.toThrow();
  });

  it("transiciones de estado", async () => {
    await asOwnerA((tx) =>
      changeCampaignStatus(tx, {
        organizationId: orgA,
        actorRole: "owner",
        id: campaignA,
        action: "activate",
      }),
    );
    await expect(
      asOwnerA((tx) =>
        changeCampaignStatus(tx, {
          organizationId: orgA,
          actorRole: "owner",
          id: campaignA,
          action: "activate",
        }),
      ),
    ).rejects.toThrow(/no aplica/);
    const list = await asOwnerA((tx) => listCampaigns(tx, orgA));
    expect(list.find((c) => c.id === campaignA)?.status).toBe("active");
  });

  it("no ve ni modifica campañas de otra organización", async () => {
    const list = await asOwnerA((tx) => listCampaigns(tx, orgB, { includeArchived: true }));
    expect(list).toEqual([]);
    await expect(
      asOwnerA((tx) =>
        changeCampaignStatus(tx, {
          organizationId: orgB,
          actorRole: "owner",
          id: campaignB,
          action: "archive",
        }),
      ),
    ).rejects.toThrow(/no existe/);
  });

  it("importa, deduplica y respeta la lista de supresión", async () => {
    await t.db.insert(suppressionList).values([
      { organizationId: orgA, kind: "email", value: "baja@clinica.com", reason: "unsubscribed" },
      {
        organizationId: orgA,
        kind: "handle",
        channel: "instagram",
        value: "nomolestar",
        reason: "requested",
      },
    ]);
    const report = await withUserContext(t.db, { sub: setterA }, (tx) =>
      ingestProspects(tx, {
        organizationId: orgA,
        campaignId: campaignA,
        source: "csv",
        sourceRef: "lista.csv",
        rows: [
          {
            row: 2,
            raw: { fullName: "Laura", email: "laura@clinica.com", instagram: "@laura.dent" },
          },
          { row: 3, raw: { fullName: "Laura bis", email: "LAURA@clinica.com" } },
          { row: 4, raw: { fullName: "Baja", email: "baja@clinica.com" } },
          { row: 5, raw: { fullName: "No molestar", instagram: "instagram.com/nomolestar" } },
          { row: 6, raw: { fullName: "Sin contacto" } },
          {
            row: 7,
            raw: {
              company: "Dental Sur",
              website: "https://www.dentalsur.com.ar",
              phone: "+54 9 11 2345 6789",
            },
          },
        ],
      }),
    );
    expect(report).toMatchObject({
      created: 2,
      duplicatesInFile: 1,
      suppressed: 2,
      invalid: 1,
      duplicatesExisting: 0,
    });
    expect(report.outcomes.map((o) => o.status)).toEqual([
      "created",
      "duplicate_in_file",
      "suppressed",
      "suppressed",
      "invalid",
      "created",
    ]);

    const again = await asOwnerA((tx) =>
      ingestProspects(tx, {
        organizationId: orgA,
        campaignId: campaignA,
        source: "csv",
        rows: [
          { row: 2, raw: { email: "otra@dentalsur.com.ar", website: "dentalsur.com.ar/contacto" } },
          { row: 3, raw: { instagram: "laura.dent" } },
          { row: 4, raw: { phone: "011 2345-6789" } },
        ],
      }),
    );
    expect(again.duplicatesExisting).toBe(2); // mismo dominio y mismo handle
    const [h] = await t.db
      .select()
      .from(prospectHandles)
      .where(eq(prospectHandles.handle, "laura.dent"));
    expect(h?.url).toBeNull();
  });

  it("los duplicados se evalúan por organización: otra org puede tener el mismo email", async () => {
    const report = await withUserContext(t.db, { sub: ownerB }, (tx) =>
      ingestProspects(tx, {
        organizationId: orgB,
        campaignId: campaignB,
        source: "manual",
        rows: [{ row: 1, raw: { email: "laura@clinica.com" } }],
      }),
    );
    expect(report.created).toBe(1);
  });

  it("dos imports en paralelo del mismo email no duplican", async () => {
    const run = () =>
      withUserContext(t.db, { sub: ownerA }, (tx) =>
        ingestProspects(tx, {
          organizationId: orgA,
          campaignId: campaignA,
          source: "csv",
          rows: [{ row: 2, raw: { email: "carrera@clinica.com" } }],
        }),
      );
    const results = await Promise.allSettled([run(), run()]);
    const rows = await t.db
      .select()
      .from(prospects)
      .where(eq(prospects.email, "carrera@clinica.com"));
    expect(rows).toHaveLength(1);
    expect(results.some((r) => r.status === "fulfilled" && r.value.created === 1)).toBe(true);
  });

  it("no permite cargar en una campaña de otra organización", async () => {
    await expect(
      asOwnerA((tx) =>
        ingestProspects(tx, {
          organizationId: orgA,
          campaignId: campaignB,
          source: "manual",
          rows: [{ row: 1, raw: { email: "x@y.com" } }],
        }),
      ),
    ).rejects.toThrow(/no existe/);
  });

  it("no permite cargar en campañas archivadas", async () => {
    await asOwnerA((tx) =>
      changeCampaignStatus(tx, {
        organizationId: orgA,
        actorRole: "owner",
        id: campaignA,
        action: "archive",
      }),
    );
    await expect(
      asOwnerA((tx) =>
        ingestProspects(tx, {
          organizationId: orgA,
          campaignId: campaignA,
          source: "manual",
          rows: [{ row: 1, raw: { email: "nuevo@y.com" } }],
        }),
      ),
    ).rejects.toThrow(/archivada/);
    await asOwnerA((tx) =>
      changeCampaignStatus(tx, {
        organizationId: orgA,
        actorRole: "owner",
        id: campaignA,
        action: "restore",
      }),
    );
  });

  it("lista y busca prospectos de la campaña", async () => {
    const all = await asOwnerA((tx) =>
      listCampaignProspects(tx, { organizationId: orgA, campaignId: campaignA }),
    );
    expect(all.total).toBeGreaterThanOrEqual(3);
    const byHandle = await asOwnerA((tx) =>
      listCampaignProspects(tx, {
        organizationId: orgA,
        campaignId: campaignA,
        search: "laura.de",
      }),
    );
    expect(byHandle.rows).toHaveLength(1);
    expect(byHandle.rows[0]?.handles).toEqual([
      { channel: "instagram", handle: "laura.dent", url: null },
    ]);
  });
});
