import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withUserContext } from "@/db/rls";
import {
  connectedAccounts,
  conversations,
  jobs,
  leadScores,
  messages,
  outreachTasks,
  pipelineStages,
  prospectHandles,
  prospects,
  suppressionList,
} from "@/db/schema";
import { campaignInputSchema, emptyCampaign } from "@/server/campaigns/schemas";
import { createCampaign } from "@/server/campaigns/service";
import { simulateInboundMessage } from "@/server/channels/accounts";
import {
  enqueueInboundMessages,
  INBOUND_JOB,
  receiveInboundMessage,
  runInboundJob,
} from "@/server/channels/inbound";
import { MetaAdapter, parseMetaWebhook } from "@/server/channels/meta";
import {
  buildMockWebhook,
  MOCK_SIGNATURE_HEADER,
  MockChannelAdapter,
  mockOutbox,
} from "@/server/channels/mock";
import { sendConversationMessage } from "@/server/channels/outbound";
import type { ChannelAdapters } from "@/server/channels/registry";
import type { InboundMessage } from "@/server/channels/types";
import type { SocialChannel } from "@/server/compliance/channels";
import { claimNextJob, completeJob, PermanentJobError } from "@/server/jobs/queue";
import { createOrganization } from "@/server/organizations/service";
import { ingestProspects } from "@/server/prospects/ingest";
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from "./setup";

const KEY = randomBytes(32).toString("base64");
const MOCK_SECRET = "mock-secret-for-tests-123";
const NOW = new Date("2026-10-14T15:00:00Z");

describe.skipIf(!TEST_DATABASE_URL)("canales entrantes", () => {
  let t: TestDatabase;
  let orgId: string;
  let ownerId: string;
  let campaignId: string;
  let adapters: ChannelAdapters;
  const accounts = {} as Record<SocialChannel, { id: string; externalId: string }>;

  async function user(email: string) {
    const id = randomUUID();
    await t.db.execute(sql`insert into auth.users (id, email) values (${id}, ${email})`);
    return id;
  }

  function inbound(channel: SocialChannel, over: Partial<InboundMessage> = {}): InboundMessage {
    return {
      provider: channel === "tiktok" ? "tiktok" : "meta",
      channel,
      mock: true,
      accountExternalId: accounts[channel].externalId,
      senderId: `s-${randomUUID()}`,
      senderHandle: null,
      senderPhone: null,
      senderName: null,
      externalMessageId: `m-${randomUUID()}`,
      text: "Hola",
      sentAt: NOW.toISOString(),
      ...over,
    };
  }

  async function stageOf(prospectId: string) {
    const [row] = await t.db
      .select({ key: pipelineStages.key })
      .from(leadScores)
      .innerJoin(pipelineStages, eq(pipelineStages.id, leadScores.stageId))
      .where(eq(leadScores.prospectId, prospectId));
    return row?.key ?? null;
  }

  async function prospectWith(raw: Record<string, string>) {
    const r = await withUserContext(t.db, { sub: ownerId }, (tx) =>
      ingestProspects(tx, {
        organizationId: orgId,
        campaignId,
        source: "manual",
        rows: [{ row: 1, raw }],
      }),
    );
    return r.outcomes[0]!.prospectId!;
  }

  beforeAll(async () => {
    t = await createTestDatabase();
    ownerId = await user(`o-${randomUUID()}@example.com`);
    orgId = (await createOrganization(t.db, { userId: ownerId, name: "Org canales" })).id;
    const data = campaignInputSchema.parse({
      ...emptyCampaign(),
      name: "Campaña redes",
      niche: "Clínicas",
      offer: "Oferta de prueba larga",
      icp: "ICP de prueba largo",
      qualificationCriteria: [{ label: "Presupuesto", weight: 50 }],
      qualificationQuestions: ["¿Cuántos?"],
      channels: ["instagram", "whatsapp", "tiktok"],
    });
    campaignId = (
      await withUserContext(t.db, { sub: ownerId }, (tx) =>
        createCampaign(tx, {
          organizationId: orgId,
          actorId: ownerId,
          actorRole: "owner",
          data,
          activate: true,
        }),
      )
    ).id;
    const mock = new MockChannelAdapter(MOCK_SECRET);
    adapters = {
      meta: new MetaAdapter({ appSecret: "s", verifyToken: "v".repeat(16), graphApiUrl: null }),
      tiktok: null,
      mock,
    };
    for (const channel of ["instagram", "facebook", "whatsapp", "tiktok"] as const) {
      const r = await mock.connect({
        db: t.db,
        organizationId: orgId,
        userId: ownerId,
        channel,
        encryptionKey: KEY,
      });
      if (r.kind !== "connected") throw new Error("no conectó");
      const [row] = await t.db
        .select({ externalId: connectedAccounts.externalId })
        .from(connectedAccounts)
        .where(eq(connectedAccounts.id, r.accountId));
      accounts[channel] = { id: r.accountId, externalId: row!.externalId };
    }
  });

  afterAll(async () => {
    await t?.drop();
  });

  it("webhook mock firmado → job → prospecto nuevo con conversación y mensaje", async () => {
    const { rawBody, signature } = buildMockWebhook(
      {
        channel: "instagram",
        accountId: accounts.instagram.externalId,
        from: { id: "igsid-nuevo", handle: "@Nueva.Clinica", name: "Clínica Nueva" },
        messageId: "mid-nuevo-1",
        text: "Hola, ¿hacen implantes?",
        timestamp: NOW.toISOString(),
      },
      MOCK_SECRET,
    );
    const result = adapters.mock!.receiveWebhook({
      method: "POST",
      headers: new Headers({ [MOCK_SIGNATURE_HEADER]: signature }),
      query: new URLSearchParams(),
      rawBody,
    });
    expect(result.kind).toBe("messages");
    if (result.kind !== "messages") return;
    // El proveedor reintenta: el mismo mensaje dos veces = un solo job.
    await enqueueInboundMessages(t.db, result.messages);
    await enqueueInboundMessages(t.db, result.messages);
    const queued = await t.db.select().from(jobs).where(eq(jobs.type, INBOUND_JOB));
    expect(queued).toHaveLength(1);

    const job = await claimNextJob(t.db, "test", { types: [INBOUND_JOB] });
    const outcome = await runInboundJob(t.db, job!);
    await completeJob(t.db, job!);
    expect(outcome).toMatchObject({ status: "stored", createdProspect: true });
    if (outcome.status !== "stored") return;

    const [p] = await t.db.select().from(prospects).where(eq(prospects.id, outcome.prospectId));
    expect(p).toMatchObject({
      source: "inbound",
      fullName: "Clínica Nueva",
      organizationId: orgId,
    });
    const handles = await t.db
      .select({ handle: prospectHandles.handle })
      .from(prospectHandles)
      .where(eq(prospectHandles.prospectId, p!.id));
    expect(handles).toEqual([{ handle: "nueva.clinica" }]);
    const [conv] = await t.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, outcome.conversationId));
    expect(conv).toMatchObject({
      channel: "instagram",
      connectedAccountId: accounts.instagram.id,
      externalThreadId: `${accounts.instagram.externalId}:igsid-nuevo`,
      businessMessagesSinceInbound: 0,
    });
    expect(conv!.lastInboundAt?.toISOString()).toBe(NOW.toISOString());
    const msgs = await t.db.select().from(messages).where(eq(messages.conversationId, conv!.id));
    expect(msgs).toMatchObject([
      { direction: "in", author: "prospect", body: "Hola, ¿hacen implantes?" },
    ]);
    expect(await stageOf(p!.id)).toBe("respondio");

    // Re-procesar el mismo mensaje no duplica nada.
    const again = await receiveInboundMessage(t.db, result.messages[0]!, NOW);
    expect(again.status).toBe("duplicate");
  });

  it("asocia por handle al prospecto existente, reutiliza la conversación manual y saltea sus tareas", async () => {
    const pid = await prospectWith({ fullName: "Dra. Paz", instagram: "@dra.paz" });
    // El setter ya le escribió a mano desde la Cola (Fase 4): conversación sin id externo.
    const [manual] = await t.db
      .insert(conversations)
      .values({ organizationId: orgId, prospectId: pid, campaignId, channel: "instagram" })
      .returning();
    await t.db.insert(outreachTasks).values({
      organizationId: orgId,
      campaignId,
      prospectId: pid,
      channel: "whatsapp",
      status: "ready",
      draftMessage: "Hola",
    });

    const outcome = await receiveInboundMessage(
      t.db,
      inbound("instagram", { senderHandle: "DRA.PAZ", senderId: "igsid-paz" }),
      NOW,
    );
    expect(outcome).toMatchObject({
      status: "stored",
      prospectId: pid,
      createdProspect: false,
      conversationId: manual!.id,
    });
    const [conv] = await t.db.select().from(conversations).where(eq(conversations.id, manual!.id));
    expect(conv!.externalThreadId).toBe(`${accounts.instagram.externalId}:igsid-paz`);
    const tasks = await t.db.select().from(outreachTasks).where(eq(outreachTasks.prospectId, pid));
    expect(tasks.map((x) => [x.status, x.skippedReason])).toEqual([
      ["skipped", "El prospecto escribió por Instagram."],
    ]);
    expect(await stageOf(pid)).toBe("respondio");

    // El segundo mensaje del mismo remitente cae en la misma conversación aunque no traiga handle.
    const second = await receiveInboundMessage(
      t.db,
      inbound("instagram", { senderId: "igsid-paz" }),
      NOW,
    );
    expect(second).toMatchObject({ conversationId: manual!.id, prospectId: pid });
  });

  it("asocia WhatsApp por teléfono (wa_id → E.164)", async () => {
    const pid = await prospectWith({ fullName: "Óptica Sur", phone: "+54 9 11 2233-4455" });
    const outcome = await receiveInboundMessage(
      t.db,
      inbound("whatsapp", {
        senderId: "5491122334455",
        senderPhone: "+5491122334455",
        senderName: "Óptica",
      }),
      NOW,
    );
    expect(outcome).toMatchObject({ status: "stored", prospectId: pid, createdProspect: false });
  });

  it("dos mensajes simultáneos de alguien nuevo crean un solo prospecto", async () => {
    const base = { senderId: "tt-concurrente", senderHandle: "concurrente" };
    const results = await Promise.all(
      [1, 2, 3].map(() => receiveInboundMessage(t.db, inbound("tiktok", base), NOW)),
    );
    const ids = new Set(results.map((r) => (r.status === "stored" ? r.prospectId : null)));
    expect(ids.size).toBe(1);
    expect(results.filter((r) => r.status === "stored" && r.createdProspect)).toHaveLength(1);
  });

  it("un webhook real no llega a una cuenta de prueba (y al revés); cuenta desconocida → job muerto", async () => {
    const real = inbound("instagram", { mock: false });
    expect(await receiveInboundMessage(t.db, real, NOW)).toEqual({ status: "unknown_account" });
    // Payload real de Meta parseado de punta a punta, dirigido a una cuenta inexistente.
    const [parsed] = parseMetaWebhook({
      object: "instagram",
      entry: [
        {
          id: "ig-que-no-existe",
          messaging: [
            {
              sender: { id: "x" },
              recipient: { id: "y" },
              timestamp: NOW.getTime(),
              message: { mid: "mid-x", text: "hola" },
            },
          ],
        },
      ],
    });
    await enqueueInboundMessages(t.db, [parsed!]);
    const job = await claimNextJob(t.db, "test", { types: [INBOUND_JOB] });
    await expect(runInboundJob(t.db, job!)).rejects.toBeInstanceOf(PermanentJobError);
  });

  it("un mensaje viejo que llega tarde no reabre la ventana ni resetea el contador", async () => {
    const senderId = "igsid-tarde";
    const first = await receiveInboundMessage(t.db, inbound("instagram", { senderId }), NOW);
    if (first.status !== "stored") throw new Error("no guardó");
    await t.db
      .update(conversations)
      .set({ businessMessagesSinceInbound: 3 })
      .where(eq(conversations.id, first.conversationId));
    const old = new Date(NOW.getTime() - 3_600_000).toISOString();
    await receiveInboundMessage(t.db, inbound("instagram", { senderId, sentAt: old }), NOW);
    const [conv] = await t.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, first.conversationId));
    expect(conv!.lastInboundAt?.toISOString()).toBe(NOW.toISOString());
    expect(conv!.businessMessagesSinceInbound).toBe(3);
  });

  describe("envío (siempre por decideOutbound)", () => {
    const deps = () => ({ db: t.db, adapters, encryptionKey: KEY, now: NOW });

    async function conversationFrom(channel: SocialChannel, senderId: string) {
      const r = await receiveInboundMessage(t.db, inbound(channel, { senderId }), NOW);
      if (r.status !== "stored") throw new Error("no guardó");
      return r.conversationId;
    }

    it("dentro de la ventana envía por el adapter y cuenta el mensaje", async () => {
      const conversationId = await conversationFrom("instagram", "igsid-envio");
      const before = mockOutbox.length;
      const r = await sendConversationMessage(deps(), {
        organizationId: orgId,
        conversationId,
        text: "¡Hola! Sí, hacemos.",
        author: "ai",
      });
      expect(r.status).toBe("sent");
      expect(mockOutbox.slice(before)).toMatchObject([
        {
          text: "¡Hola! Sí, hacemos.",
          target: {
            channel: "instagram",
            recipientId: "igsid-envio",
            accessToken: expect.stringMatching(/^mock-token-/),
          },
        },
      ]);
      const [conv] = await t.db
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversationId));
      expect(conv!.businessMessagesSinceInbound).toBe(1);
      const out = await t.db
        .select()
        .from(messages)
        .where(and(eq(messages.conversationId, conversationId), eq(messages.direction, "out")));
      expect(out).toMatchObject([{ author: "ai", body: "¡Hola! Sí, hacemos." }]);
    });

    it("TikTok: con 10 mensajes del negocio no envía y deja tarea manual", async () => {
      const conversationId = await conversationFrom("tiktok", "tt-tope");
      await t.db
        .update(conversations)
        .set({ businessMessagesSinceInbound: 10 })
        .where(eq(conversations.id, conversationId));
      const before = mockOutbox.length;
      const r = await sendConversationMessage(deps(), {
        organizationId: orgId,
        conversationId,
        text: "Uno más",
        author: "ai",
      });
      expect(r).toEqual({
        status: "not_sent",
        decision: { action: "manual_task", reason: "message_cap_reached" },
      });
      expect(mockOutbox.length).toBe(before);
      const [conv] = await t.db
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversationId));
      const tasks = await t.db
        .select()
        .from(outreachTasks)
        .where(eq(outreachTasks.prospectId, conv!.prospectId));
      expect(tasks).toMatchObject([
        { channel: "tiktok", status: "ready", draftMessage: "Uno más" },
      ]);
    });

    it("ventana vencida → tarea manual; WhatsApp con opt-in → plantilla; suprimido → bloqueado", async () => {
      const later = new Date(NOW.getTime() + 25 * 3_600_000);
      const ig = await conversationFrom("instagram", "igsid-vencida");
      expect(
        await sendConversationMessage(
          { ...deps(), now: later },
          { organizationId: orgId, conversationId: ig, text: "x", author: "ai" },
        ),
      ).toMatchObject({ status: "not_sent", decision: { reason: "window_expired" } });

      const wa = await conversationFrom("whatsapp", "5491155556666");
      const [conv] = await t.db.select().from(conversations).where(eq(conversations.id, wa));
      await t.db
        .update(prospects)
        .set({ phone: "+5491155556666", whatsappOptIn: true, whatsappOptInAt: NOW })
        .where(eq(prospects.id, conv!.prospectId));
      expect(
        await sendConversationMessage(
          { ...deps(), now: later },
          { organizationId: orgId, conversationId: wa, text: "x", author: "ai" },
        ),
      ).toMatchObject({ status: "not_sent", decision: { action: "whatsapp_template" } });

      await t.db.insert(suppressionList).values({
        organizationId: orgId,
        kind: "phone",
        value: "+5491155556666",
        reason: "requested",
      });
      const before = mockOutbox.length;
      expect(
        await sendConversationMessage(deps(), {
          organizationId: orgId,
          conversationId: wa,
          text: "x",
          author: "ai",
        }),
      ).toMatchObject({ status: "not_sent", decision: { action: "blocked" } });
      expect(mockOutbox.length).toBe(before);
    });

    it("sin mensaje del contacto nunca envía (primer contacto = persona)", async () => {
      const pid = await prospectWith({ fullName: "Sin escribir", instagram: "@sin.escribir" });
      const [conv] = await t.db
        .insert(conversations)
        .values({ organizationId: orgId, prospectId: pid, campaignId, channel: "instagram" })
        .returning();
      expect(
        await sendConversationMessage(deps(), {
          organizationId: orgId,
          conversationId: conv!.id,
          text: "x",
          author: "ai",
        }),
      ).toMatchObject({ status: "not_sent", decision: { reason: "first_contact_requires_human" } });
    });
  });

  it("el simulador pasa por el mismo camino y solo funciona sobre cuentas de prueba", async () => {
    const msg = await simulateInboundMessage(t.db, adapters, {
      organizationId: orgId,
      accountId: accounts.facebook.id,
      secret: MOCK_SECRET,
      from: { handle: "pagina.amiga", phone: null, name: null },
      text: "Hola desde Messenger",
      now: NOW,
    });
    expect(msg).toMatchObject({ channel: "facebook", mock: true, senderHandle: "pagina.amiga" });
    const job = await claimNextJob(t.db, "test", { types: [INBOUND_JOB] });
    expect(await runInboundJob(t.db, job!)).toMatchObject({
      status: "stored",
      createdProspect: true,
    });

    const [real] = await t.db
      .insert(connectedAccounts)
      .values({
        organizationId: orgId,
        provider: "meta",
        channel: "instagram",
        externalId: "ig-real-1",
      })
      .returning();
    await expect(
      simulateInboundMessage(t.db, adapters, {
        organizationId: orgId,
        accountId: real!.id,
        secret: MOCK_SECRET,
        from: { handle: "x", phone: null, name: null },
        text: "x",
      }),
    ).rejects.toThrow(/cuenta de prueba/);
  });

  it("una cuenta de red social no puede estar conectada en dos organizaciones", async () => {
    const otherOwner = await user(`o2-${randomUUID()}@example.com`);
    const other = await createOrganization(t.db, { userId: otherOwner, name: "Otra" });
    await expect(
      t.db.insert(connectedAccounts).values({
        organizationId: other.id,
        provider: "meta",
        channel: "instagram",
        externalId: "ig-real-1",
      }),
    ).rejects.toThrow();
    // Email sí puede (misma casilla en dos organizaciones es decisión del cliente).
    for (const organizationId of [orgId, other.id]) {
      await t.db.insert(connectedAccounts).values({
        organizationId,
        provider: "google",
        channel: "email",
        externalId: "compartida@example.com",
      });
    }
  });
});
