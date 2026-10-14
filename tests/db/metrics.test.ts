import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withUserContext } from "@/db/rls";
import {
  aiRuns,
  campaigns,
  conversations,
  leadStageEvents,
  meetings,
  memberships,
  messages,
  outreachTasks,
  pipelineStages,
  prospects,
} from "@/db/schema";
import { SETTER_AI, SETTER_AUTO } from "@/server/metrics/aggregate";
import { getMetrics } from "@/server/metrics/service";
import { createOrganization } from "@/server/organizations/service";
import { moveLead } from "@/server/pipeline/board";
import { advanceLeadStage } from "@/server/pipeline/stages";
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from "./setup";

const DAY = 86_400_000;

describe.skipIf(!TEST_DATABASE_URL)("métricas", () => {
  let t: TestDatabase;
  let orgId: string;
  let ownerId: string;
  let setterId: string;
  let campA: string;
  let campB: string;
  const now = new Date();
  const ago = (days: number) => new Date(now.getTime() - days * DAY);
  const period = { from: ago(30), to: new Date(now.getTime() + 1000) };

  async function user() {
    const id = randomUUID();
    await t.db.execute(
      sql`insert into auth.users (id, email) values (${id}, ${`u-${id}@example.com`})`,
    );
    return id;
  }

  async function prospectWithConv(campaignId: string, channel: "instagram" | "email" | "whatsapp") {
    const [p] = await t.db
      .insert(prospects)
      .values({ organizationId: orgId, campaignId, fullName: `P ${randomUUID().slice(0, 4)}` })
      .returning();
    const [c] = await t.db
      .insert(conversations)
      .values({ organizationId: orgId, prospectId: p!.id, campaignId, channel })
      .returning();
    return { prospectId: p!.id, conversationId: c!.id };
  }

  async function msg(
    conversationId: string,
    direction: "in" | "out",
    at: Date,
    author: "human" | "ai" | "prospect",
    sentByUserId: string | null = null,
  ) {
    await t.db.insert(messages).values({
      organizationId: orgId,
      conversationId,
      direction,
      author,
      sentByUserId,
      body: "x",
      sentAt: at,
    });
  }

  const report = (campaignId?: string) =>
    withUserContext(t.db, { sub: ownerId }, (tx) =>
      getMetrics(tx, { organizationId: orgId, ...period, campaignId }),
    );

  beforeAll(async () => {
    t = await createTestDatabase();
    ownerId = await user();
    setterId = await user();
    orgId = (await createOrganization(t.db, { userId: ownerId, name: "Org métricas" })).id;
    await t.db
      .insert(memberships)
      .values({ organizationId: orgId, userId: setterId, role: "setter" });
    const mk = async (name: string) =>
      (
        await t.db
          .insert(campaigns)
          .values({
            organizationId: orgId,
            name,
            niche: "n",
            offer: "o",
            icp: "i",
            status: "active",
          })
          .returning()
      )[0]!.id;
    campA = await mk("Campaña A");
    campB = await mk("Campaña B");

    // P1 (A, Instagram): el setter le escribe y responde → calificado.
    const p1 = await prospectWithConv(campA, "instagram");
    await msg(p1.conversationId, "out", ago(5), "human", setterId);
    await msg(p1.conversationId, "in", ago(4), "prospect");
    await advanceLeadStage(t.db, {
      organizationId: orgId,
      prospectId: p1.prospectId,
      campaignId: campA,
      to: "contactado",
      from: ["nuevo"],
    });
    await advanceLeadStage(t.db, {
      organizationId: orgId,
      prospectId: p1.prospectId,
      campaignId: campA,
      to: "calificado",
      from: ["contactado"],
    });

    // P2 (A, Instagram): el setter le escribe y no responde.
    const p2 = await prospectWithConv(campA, "instagram");
    await msg(p2.conversationId, "out", ago(3), "human", setterId);

    // P3 (B, Instagram): escribe él, responde la IA, vuelve a escribir y agenda.
    const p3 = await prospectWithConv(campB, "instagram");
    await msg(p3.conversationId, "in", ago(2), "prospect");
    await msg(p3.conversationId, "out", ago(2 - 0.01), "ai");
    await msg(p3.conversationId, "in", ago(1), "prospect");
    await t.db.insert(meetings).values({
      organizationId: orgId,
      prospectId: p3.prospectId,
      conversationId: p3.conversationId,
      campaignId: campB,
      externalEventId: "ev-1",
      startsAt: now,
      endsAt: now,
    });
    await t.db.insert(aiRuns).values({
      organizationId: orgId,
      type: "reply",
      model: "m",
      costUsd: "0.5",
      prospectId: p3.prospectId,
      conversationId: p3.conversationId,
    });

    // P4 (B, email): secuencia automática, sin respuesta. Más un envío viejo fuera del período.
    const p4 = await prospectWithConv(campB, "email");
    await msg(p4.conversationId, "out", ago(6), "human", null);
    await msg(p4.conversationId, "out", ago(40), "human", null);

    // Borrador de WhatsApp sin precio configurado (costo null).
    const [draft] = await t.db
      .insert(aiRuns)
      .values({ organizationId: orgId, type: "draft", model: "m", prospectId: p2.prospectId })
      .returning();
    await t.db.insert(outreachTasks).values({
      organizationId: orgId,
      campaignId: campA,
      prospectId: p2.prospectId,
      channel: "whatsapp",
      aiRunId: draft!.id,
      status: "ready",
    });
  });

  afterAll(async () => {
    await t?.drop();
  });

  it("totales del período", async () => {
    const r = await report();
    expect(r.totals).toMatchObject({
      sent: 4, // p1, p2, p3 (IA), p4 (el de hace 40 días no)
      contacted: 4,
      responded: 2, // p1 y p3
      qualified: 1,
      booked: 1,
      aiRuns: 2,
      aiCostUsd: 0.5,
    });
    expect(r.totals.responseRate).toBe(0.5);
    expect(r.unpricedAiRuns).toBe(1);
  });

  it("por campaña", async () => {
    const r = await report();
    const a = r.byCampaign.find((x) => x.key === campA)!;
    const b = r.byCampaign.find((x) => x.key === campB)!;
    expect(a).toMatchObject({
      sent: 2,
      contacted: 2,
      responded: 1,
      qualified: 1,
      booked: 0,
      aiRuns: 1,
      aiCostUsd: null,
    });
    expect(b).toMatchObject({
      sent: 2,
      contacted: 2,
      responded: 1,
      qualified: 0,
      booked: 1,
      aiRuns: 1,
      aiCostUsd: 0.5,
    });
  });

  it("por canal (la tasa se mide dentro del canal)", async () => {
    const r = await report();
    const ig = r.byChannel.find((x) => x.key === "instagram")!;
    expect(ig).toMatchObject({
      sent: 3,
      contacted: 3,
      responded: 2,
      qualified: 1,
      booked: 1,
      aiCostUsd: 0.5,
    });
    expect(r.byChannel.find((x) => x.key === "email")).toMatchObject({
      sent: 1,
      contacted: 1,
      responded: 0,
    });
    // El borrador de WhatsApp cuenta en costo/corridas del canal aunque no haya envíos.
    expect(r.byChannel.find((x) => x.key === "whatsapp")).toMatchObject({ sent: 0, aiRuns: 1 });
  });

  it("por setter: personas, IA y automático; la IA no se atribuye costo a personas", async () => {
    const r = await report();
    expect(r.bySetter.find((x) => x.key === setterId)).toMatchObject({
      sent: 2,
      contacted: 2,
      responded: 1,
      qualified: 1,
      booked: 0,
      aiCostUsd: null,
    });
    expect(r.bySetter.find((x) => x.key === SETTER_AI)).toMatchObject({
      sent: 1,
      responded: 1,
      booked: 1,
    });
    expect(r.bySetter.find((x) => x.key === SETTER_AUTO)).toMatchObject({ sent: 1, responded: 0 });
  });

  it("filtro por campaña", async () => {
    const r = await report(campA);
    expect(r.totals).toMatchObject({ sent: 2, contacted: 2, booked: 0, aiRuns: 1 });
  });

  it("el historial de etapas lo escribe la base, con el actor si hay sesión", async () => {
    const [lead] = await t.db.execute<{ id: string }>(
      sql`select id from lead_scores where organization_id = ${orgId} and campaign_id = ${campA} limit 1`,
    );
    const [ganado] = await t.db
      .select()
      .from(pipelineStages)
      .where(and(eq(pipelineStages.organizationId, orgId), eq(pipelineStages.key, "ganado")));
    await withUserContext(t.db, { sub: setterId }, (tx) =>
      moveLead(tx, { organizationId: orgId, leadId: lead!.id, stageId: ganado!.id }),
    );
    const events = await t.db
      .select({ key: leadStageEvents.stageKey, actor: leadStageEvents.actorUserId })
      .from(leadStageEvents)
      .where(eq(leadStageEvents.leadScoreId, lead!.id))
      .orderBy(leadStageEvents.at);
    expect(events.map((e) => e.key)).toEqual(["contactado", "calificado", "ganado"]);
    expect(events.at(-1)!.actor).toBe(setterId);
    expect(events[0]!.actor).toBeNull();
    // Desde el cliente no se pueden inventar eventos.
    await expect(
      withUserContext(t.db, { sub: ownerId }, (tx) =>
        tx.insert(leadStageEvents).values({
          organizationId: orgId,
          leadScoreId: lead!.id,
          prospectId: randomUUID(),
          stageId: ganado!.id,
          stageKey: "ganado",
        }),
      ),
    ).rejects.toThrow();
  });

  it("otra organización no ve nada", async () => {
    const other = await user();
    await createOrganization(t.db, { userId: other, name: "Otra" });
    const r = await withUserContext(t.db, { sub: other }, (tx) =>
      getMetrics(tx, { organizationId: orgId, ...period }),
    );
    expect(r.totals).toMatchObject({ sent: 0, contacted: 0, qualified: 0, booked: 0, aiRuns: 0 });
  });
});
