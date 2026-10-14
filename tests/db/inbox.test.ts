import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withUserContext } from "@/db/rls";
import {
  campaigns,
  connectedAccounts,
  conversations,
  leadScores,
  memberships,
  messages,
  outreachTasks,
  pipelineStages,
  prospects,
  suppressionList,
} from "@/db/schema";
import { agentSettingsSchema } from "@/server/agent/settings";
import { campaignInputSchema, emptyCampaign } from "@/server/campaigns/schemas";
import { createCampaign } from "@/server/campaigns/service";
import { receiveInboundMessage } from "@/server/channels/inbound";
import { MockChannelAdapter, mockOutbox } from "@/server/channels/mock";
import type { InboundMessage } from "@/server/channels/types";
import { FakeMailProvider } from "@/server/email/gmail";
import { replyManually, type ReplyDeps } from "@/server/inbox/reply";
import { assignConversation, INBOX_PAGE_SIZE, listConversations } from "@/server/inbox/service";
import { createOrganization } from "@/server/organizations/service";
import { getBoard, moveLead } from "@/server/pipeline/board";
import { ingestProspects } from "@/server/prospects/ingest";
import { getProspectRecord } from "@/server/prospects/record";
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from "./setup";

const KEY = randomBytes(32).toString("base64");

describe.skipIf(!TEST_DATABASE_URL)("bandeja, CRM y ficha", () => {
  let t: TestDatabase;
  let orgId: string;
  let ownerId: string;
  let setterId: string;
  let campaignId: string;
  let ig: { id: string; externalId: string };
  let mailboxId: string;
  let mail: FakeMailProvider;
  let deps: ReplyDeps;

  async function user(email: string) {
    const id = randomUUID();
    await t.db.execute(sql`insert into auth.users (id, email) values (${id}, ${email})`);
    return id;
  }

  async function inboundFrom(sender: string, text = "Hola", over: Partial<InboundMessage> = {}) {
    const r = await receiveInboundMessage(t.db, {
      provider: "meta",
      channel: "instagram",
      mock: true,
      accountExternalId: ig.externalId,
      senderId: sender,
      senderHandle: sender,
      senderPhone: null,
      senderName: null,
      externalMessageId: `m-${randomUUID()}`,
      text,
      sentAt: new Date().toISOString(),
      ...over,
    });
    if (r.status !== "stored" && r.status !== "duplicate") throw new Error(r.status);
    return r;
  }

  const asOwner = <T>(fn: Parameters<typeof withUserContext<T>>[2]) =>
    withUserContext(t.db, { sub: ownerId }, fn);

  beforeAll(async () => {
    t = await createTestDatabase();
    ownerId = await user(`o-${randomUUID()}@example.com`);
    setterId = await user(`s-${randomUUID()}@example.com`);
    orgId = (await createOrganization(t.db, { userId: ownerId, name: "Org bandeja" })).id;
    await t.db
      .insert(memberships)
      .values({ organizationId: orgId, userId: setterId, role: "setter" });
    const data = campaignInputSchema.parse({
      ...emptyCampaign(),
      name: "Campaña bandeja",
      niche: "Clínicas",
      offer: "Oferta de prueba larga",
      icp: "ICP de prueba largo",
      qualificationCriteria: [{ label: "Presupuesto", weight: 50 }],
      qualificationQuestions: ["¿Cuántos?"],
      channels: ["instagram", "email"],
    });
    campaignId = (
      await asOwner((tx) =>
        createCampaign(tx, {
          organizationId: orgId,
          actorId: ownerId,
          actorRole: "owner",
          data,
          activate: true,
        }),
      )
    ).id;
    const mock = new MockChannelAdapter("mock-secret-inbox-123456");
    const r = await mock.connect({
      db: t.db,
      organizationId: orgId,
      userId: ownerId,
      channel: "instagram",
      encryptionKey: KEY,
    });
    if (r.kind !== "connected") throw new Error("no conectó");
    const [acct] = await t.db
      .update(connectedAccounts)
      .set({ settings: { mock: true, defaultCampaignId: campaignId } })
      .where(eq(connectedAccounts.id, r.accountId))
      .returning();
    ig = { id: acct!.id, externalId: acct!.externalId };
    const [mb] = await t.db
      .insert(connectedAccounts)
      .values({
        organizationId: orgId,
        provider: "google",
        channel: "email",
        externalId: "ventas@agencia.example.com",
        signature: "Ana\nAgencia",
      })
      .returning();
    mailboxId = mb!.id;
    mail = new FakeMailProvider();
    deps = {
      db: t.db,
      adapters: { meta: null, tiktok: null, mock },
      encryptionKey: KEY,
      mail,
      appUrl: "https://app.example.com",
      unsubscribeSecret: "x".repeat(40),
    };
  });

  afterAll(async () => {
    await t?.drop();
  });

  describe("filtros de la bandeja", () => {
    it("por canal, campaña, etapa, asignado y estado de la IA", async () => {
      const a = await inboundFrom(`filtro.a.${randomUUID().slice(0, 6)}`);
      const b = await inboundFrom(`filtro.b.${randomUUID().slice(0, 6)}`);
      await t.db
        .update(conversations)
        .set({ assignedTo: setterId, aiPaused: true })
        .where(eq(conversations.id, b.conversationId));

      const ids = async (filters: Parameters<typeof listConversations>[2]) =>
        (await asOwner((tx) => listConversations(tx, orgId, filters))).items.map((c) => c.id);

      expect(await ids({ filters: { canal: "instagram" } })).toEqual(
        expect.arrayContaining([a.conversationId, b.conversationId]),
      );
      expect(await ids({ filters: { canal: "email" } })).not.toContain(a.conversationId);
      expect(await ids({ filters: { campana: campaignId } })).toEqual(
        expect.arrayContaining([a.conversationId]),
      );
      expect(await ids({ filters: { campana: "sin" } })).not.toContain(a.conversationId);
      expect(await ids({ filters: { etapa: "respondio" } })).toEqual(
        expect.arrayContaining([a.conversationId]),
      );
      expect(await ids({ filters: { etapa: "agendado" } })).not.toContain(a.conversationId);
      expect(await ids({ filters: { asignado: setterId } })).toEqual([b.conversationId]);
      expect(await ids({ filters: { asignado: "nadie" } })).not.toContain(b.conversationId);
      expect(await ids({ filters: { asignado: "yo" }, userId: setterId })).toEqual([
        b.conversationId,
      ]);
      expect(await ids({ filters: { estado: "pausada" } })).toEqual([b.conversationId]);

      const [row] = (
        await asOwner((tx) => listConversations(tx, orgId, { filters: { asignado: setterId } }))
      ).items;
      expect(row).toMatchObject({ stageName: "Respondió", campaignName: "Campaña bandeja" });
      expect(row!.assigneeName).toMatch(/^s-/);
    });

    it("pagina", async () => {
      const first = await asOwner((tx) => listConversations(tx, orgId));
      expect(first.items.length).toBeLessThanOrEqual(INBOX_PAGE_SIZE);
      const second = await asOwner((tx) =>
        listConversations(tx, orgId, { filters: { pagina: 2 } }),
      );
      expect(second.page).toBe(2);
    });

    it("asignar solo a miembros de la organización", async () => {
      const c = await inboundFrom(`asignar.${randomUUID().slice(0, 6)}`);
      await withUserContext(t.db, { sub: setterId }, (tx) =>
        assignConversation(tx, {
          organizationId: orgId,
          conversationId: c.conversationId,
          userId: setterId,
        }),
      );
      const outsider = await user(`x-${randomUUID()}@example.com`);
      await expect(
        asOwner((tx) =>
          assignConversation(tx, {
            organizationId: orgId,
            conversationId: c.conversationId,
            userId: outsider,
          }),
        ),
      ).rejects.toThrow(/no es del equipo/);
    });
  });

  describe("respuesta manual", () => {
    it("dentro de la ventana envía como persona, se la asigna y pausa la IA", async () => {
      await t.db
        .update(campaigns)
        .set({ agentSettings: agentSettingsSchema.parse({ enabled: true }) })
        .where(eq(campaigns.id, campaignId));
      const c = await inboundFrom(`manual.${randomUUID().slice(0, 6)}`);
      const before = mockOutbox.length;
      const r = await replyManually(deps, {
        organizationId: orgId,
        conversationId: c.conversationId,
        userId: setterId,
        text: " ¡Hola! Te escribo yo. ",
      });
      expect(r).toEqual({ status: "sent" });
      expect(mockOutbox.slice(before)).toMatchObject([{ text: "¡Hola! Te escribo yo." }]);
      const [out] = await t.db
        .select()
        .from(messages)
        .where(and(eq(messages.conversationId, c.conversationId), eq(messages.direction, "out")));
      expect(out).toMatchObject({ author: "human", sentByUserId: setterId });
      const [conv] = await t.db
        .select()
        .from(conversations)
        .where(eq(conversations.id, c.conversationId));
      expect(conv).toMatchObject({
        assignedTo: setterId,
        aiPaused: true,
        aiPausedReason: "Respondió una persona del equipo.",
      });
      await t.db.update(campaigns).set({ agentSettings: {} }).where(eq(campaigns.id, campaignId));
    });

    it("ventana vencida: no envía y deja la tarea en la Cola", async () => {
      const c = await inboundFrom(`vencida.${randomUUID().slice(0, 6)}`, "Hola", {
        sentAt: new Date(Date.now() - 30 * 3_600_000).toISOString(),
      });
      const before = mockOutbox.length;
      const r = await replyManually(deps, {
        organizationId: orgId,
        conversationId: c.conversationId,
        userId: ownerId,
        text: "Perdón la demora",
      });
      expect(r.status).toBe("manual_task");
      expect(mockOutbox.length).toBe(before);
      const [conv] = await t.db
        .select()
        .from(conversations)
        .where(eq(conversations.id, c.conversationId));
      const tasks = await t.db
        .select()
        .from(outreachTasks)
        .where(eq(outreachTasks.prospectId, conv!.prospectId));
      expect(tasks).toMatchObject([
        { status: "ready", draftMessage: "Perdón la demora", channel: "instagram" },
      ]);
    });

    it("suprimido: bloqueado", async () => {
      const handle = `suprimido.${randomUUID().slice(0, 6)}`;
      const c = await inboundFrom(handle);
      await t.db
        .insert(suppressionList)
        .values({ organizationId: orgId, kind: "handle", value: handle, reason: "requested" });
      const r = await replyManually(deps, {
        organizationId: orgId,
        conversationId: c.conversationId,
        userId: ownerId,
        text: "Hola",
      });
      expect(r.status).toBe("blocked");
    });

    it("email: responde en el mismo hilo con Re:, firma y link de baja", async () => {
      const report = await asOwner((tx) =>
        ingestProspects(tx, {
          organizationId: orgId,
          campaignId,
          source: "manual",
          rows: [
            {
              row: 1,
              raw: {
                fullName: "Laura",
                email: `laura-${randomUUID().slice(0, 6)}@clinica.example.com`,
              },
            },
          ],
        }),
      );
      const prospectId = report.outcomes[0]!.prospectId!;
      const ref = { id: mailboxId, organizationId: orgId, email: "ventas@agencia.example.com" };
      const first = await mail.send(ref, { raw: "x" });
      mail.threads.get(first.threadId)![0]!.subject = "Una idea para tu clínica";
      mail.addReply(first.threadId, {
        from: "laura@clinica.example.com",
        text: "Contame",
        rfcMessageId: "<r1@x>",
      });
      const [conv] = await t.db
        .insert(conversations)
        .values({
          organizationId: orgId,
          prospectId,
          campaignId,
          channel: "email",
          connectedAccountId: mailboxId,
          externalThreadId: first.threadId,
        })
        .returning();
      const r = await replyManually(deps, {
        organizationId: orgId,
        conversationId: conv!.id,
        userId: ownerId,
        text: "¡Claro! Te cuento.",
      });
      expect(r).toEqual({ status: "sent" });
      const sent = mail.sent.at(-1)!;
      expect(sent.threadId).toBe(first.threadId);
      const raw = sent.raw;
      expect(raw).toMatch(/In-Reply-To: <r1@x>/);
      expect(raw).toMatch(/List-Unsubscribe: <https:\/\/app\.example\.com\/api\/baja\//);
      const [out] = await t.db
        .select()
        .from(messages)
        .where(and(eq(messages.conversationId, conv!.id), eq(messages.direction, "out")));
      expect(out!.body).toMatch(/¡Claro! Te cuento\.[\s\S]*Ana\nAgencia[\s\S]*\/baja\//);
    });
  });

  describe("CRM", () => {
    it("tablero por etapa y mover leads (cualquier miembro; etapas de la propia org)", async () => {
      const c = await inboundFrom(`crm.${randomUUID().slice(0, 6)}`);
      const board = await asOwner((tx) => getBoard(tx, orgId));
      expect(board.map((col) => col.key)).toEqual([
        "nuevo",
        "contactado",
        "respondio",
        "calificado",
        "agendado",
        "ganado",
        "perdido",
      ]);
      const respondio = board.find((col) => col.key === "respondio")!;
      const [conv] = await t.db
        .select()
        .from(conversations)
        .where(eq(conversations.id, c.conversationId));
      const lead = respondio.leads.find((l) => l.prospectId === conv!.prospectId)!;
      expect(lead).toBeDefined();

      const ganado = board.find((col) => col.key === "ganado")!;
      await withUserContext(t.db, { sub: setterId }, (tx) =>
        moveLead(tx, { organizationId: orgId, leadId: lead.id, stageId: ganado.id }),
      );
      const [row] = await t.db
        .select({ key: pipelineStages.key })
        .from(leadScores)
        .innerJoin(pipelineStages, eq(pipelineStages.id, leadScores.stageId))
        .where(eq(leadScores.id, lead.id));
      expect(row!.key).toBe("ganado");

      // Una etapa de otra organización no sirve.
      const otherOwner = await user(`oo-${randomUUID()}@example.com`);
      const other = await createOrganization(t.db, { userId: otherOwner, name: "Otra" });
      const [foreign] = await t.db
        .select()
        .from(pipelineStages)
        .where(eq(pipelineStages.organizationId, other.id))
        .limit(1);
      await expect(
        asOwner((tx) =>
          moveLead(tx, { organizationId: orgId, leadId: lead.id, stageId: foreign!.id }),
        ),
      ).rejects.toThrow(/etapa no existe/);

      // Búsqueda y filtro por campaña.
      const handle = (
        await t.db.select().from(prospects).where(eq(prospects.id, conv!.prospectId))
      )[0]!;
      const filtered = await asOwner((tx) => getBoard(tx, orgId, { q: "crm." }));
      expect(filtered.flatMap((col) => col.leads).map((l) => l.prospectId)).toContain(handle.id);
      const none = await asOwner((tx) => getBoard(tx, orgId, { q: "no-existe-nadie" }));
      expect(none.flatMap((col) => col.leads)).toEqual([]);
    });
  });

  describe("ficha del prospecto", () => {
    it("historial de todos los canales, puntaje y nada de otra organización", async () => {
      const sender = `ficha.${randomUUID().slice(0, 6)}`;
      const c = await inboundFrom(sender, "Primero");
      await inboundFrom(sender, "Segundo");
      const [conv] = await t.db
        .select()
        .from(conversations)
        .where(eq(conversations.id, c.conversationId));
      const record = await asOwner((tx) => getProspectRecord(tx, orgId, conv!.prospectId));
      expect(record!.history.map((m) => [m.body, m.channel])).toEqual([
        ["Primero", "instagram"],
        ["Segundo", "instagram"],
      ]);
      expect(record!.leads[0]).toMatchObject({
        stage: "Respondió",
        campaignName: "Campaña bandeja",
      });
      expect(record!.leads[0]!.questions).toEqual([{ text: "¿Cuántos?", answer: null }]);

      const otherOwner = await user(`o3-${randomUUID()}@example.com`);
      await createOrganization(t.db, { userId: otherOwner, name: "Ajena" });
      const foreign = await withUserContext(t.db, { sub: otherOwner }, (tx) =>
        getProspectRecord(tx, orgId, conv!.prospectId),
      );
      expect(foreign).toBeNull();
    });
  });
});
