import { randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withUserContext } from "@/db/rls";
import {
  aiRuns,
  campaigns,
  connectedAccounts,
  conversations,
  jobs,
  leadScores,
  meetings,
  messages,
  notifications,
  pipelineStages,
} from "@/db/schema";
import { AGENT_JOB, resumeAgent, runAgentReplyJob, type AgentDeps } from "@/server/agent/agent";
import { agentSettingsSchema } from "@/server/agent/settings";
import { AiError } from "@/server/ai/client";
import type { AiConfig } from "@/server/ai/config";
import { FakeAiClient } from "@/server/ai/fake-client";
import { FakeCalendarProvider } from "@/server/calendar/google-calendar";
import { campaignInputSchema, emptyCampaign } from "@/server/campaigns/schemas";
import { createCampaign } from "@/server/campaigns/service";
import { INBOUND_JOB, enqueueInboundMessages, runInboundJob } from "@/server/channels/inbound";
import { MockChannelAdapter, mockOutbox } from "@/server/channels/mock";
import type { InboundMessage } from "@/server/channels/types";
import { claimNextJob, completeJob } from "@/server/jobs/queue";
import { createOrganization } from "@/server/organizations/service";
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from "./setup";

const KEY = randomBytes(32).toString("base64");
const QUESTIONS = ["¿Cuántos pacientes nuevos reciben por mes?", "¿Quién maneja hoy el marketing?"];
const tier = { model: "fake", effort: null, priceInputPerMTok: null, priceOutputPerMTok: null };
const config: AiConfig = { fast: tier, smart: tier };

describe.skipIf(!TEST_DATABASE_URL)("agente conversacional", () => {
  let t: TestDatabase;
  let orgId: string;
  let ownerId: string;
  let campaignId: string;
  let calendarId: string;
  let igAccount: { id: string; externalId: string };
  let ai: FakeAiClient;
  let calendar: FakeCalendarProvider;
  let deps: AgentDeps;
  let sender: string;

  async function setAgent(over: Record<string, unknown> = {}) {
    await t.db
      .update(campaigns)
      .set({
        agentSettings: agentSettingsSchema.parse({
          enabled: true,
          replyDelayMinSeconds: 0,
          replyDelayMaxSeconds: 0,
          calendarAccountId: calendarId,
          meetingStartHour: 0,
          meetingEndHour: 24,
          meetingDays: [0, 1, 2, 3, 4, 5, 6],
          minNoticeHours: 2,
          ...over,
        }),
      })
      .where(eq(campaigns.id, campaignId));
  }

  /** Simula un mensaje entrante y procesa los jobs (entrante + agente). */
  async function receive(text: string, opts: { runAgent?: boolean } = {}) {
    const msg: InboundMessage = {
      provider: "meta",
      channel: "instagram",
      mock: true,
      accountExternalId: igAccount.externalId,
      senderId: sender,
      senderHandle: null,
      senderPhone: null,
      senderName: "Laura",
      externalMessageId: `m-${randomUUID()}`,
      text,
      sentAt: new Date().toISOString(),
    };
    await enqueueInboundMessages(t.db, [msg]);
    const inbound = await claimNextJob(t.db, "test", { types: [INBOUND_JOB] });
    const outcome = await runInboundJob(t.db, inbound!);
    await completeJob(t.db, inbound!);
    if (opts.runAgent === false) return { conversationId: outcome.conversationId, agent: null };
    return { conversationId: outcome.conversationId, agent: await runAgent() };
  }

  async function runAgent() {
    const job = await claimNextJob(t.db, "test", { types: [AGENT_JOB] });
    if (!job) return null;
    try {
      return await runAgentReplyJob(deps, job);
    } finally {
      await completeJob(t.db, job);
    }
  }

  async function lastOut(conversationId: string) {
    const [m] = await t.db
      .select()
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), eq(messages.direction, "out")))
      .orderBy(desc(messages.sentAt))
      .limit(1);
    return m;
  }

  async function stageOf(conversationId: string) {
    const [conv] = await t.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId));
    const [row] = await t.db
      .select({ key: pipelineStages.key, score: leadScores.score, answers: leadScores.answers })
      .from(leadScores)
      .innerJoin(pipelineStages, eq(pipelineStages.id, leadScores.stageId))
      .where(
        and(eq(leadScores.prospectId, conv!.prospectId), eq(leadScores.campaignId, campaignId)),
      );
    return { conv: conv!, ...row };
  }

  beforeAll(async () => {
    t = await createTestDatabase();
    ownerId = randomUUID();
    await t.db.execute(
      sql`insert into auth.users (id, email) values (${ownerId}, ${`o-${ownerId}@example.com`})`,
    );
    orgId = (await createOrganization(t.db, { userId: ownerId, name: "Clínica Norte" })).id;
    const data = campaignInputSchema.parse({
      ...emptyCampaign(),
      name: "Campaña agente",
      niche: "Clínicas",
      offer: "Sistema de captación de pacientes",
      icp: "Clínicas de 2 a 10 sillones",
      qualificationCriteria: [
        { label: "Tiene presupuesto", weight: 60 },
        { label: "Decide la compra", weight: 40 },
      ],
      qualificationQuestions: QUESTIONS,
      channels: ["instagram"],
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
    const [cal] = await t.db
      .insert(connectedAccounts)
      .values({
        organizationId: orgId,
        provider: "google",
        externalId: "calendar:agenda@clinica.example.com",
        displayName: "agenda@clinica.example.com",
        settings: { kind: "calendar" },
      })
      .returning();
    calendarId = cal!.id;
    const mock = new MockChannelAdapter("mock-secret-agent-123456");
    const r = await mock.connect({
      db: t.db,
      organizationId: orgId,
      userId: ownerId,
      channel: "instagram",
      encryptionKey: KEY,
    });
    if (r.kind !== "connected") throw new Error("no conectó");
    // Los mensajes nuevos de esta cuenta entran a la campaña del agente.
    const [acct] = await t.db
      .update(connectedAccounts)
      .set({ settings: { mock: true, defaultCampaignId: campaignId } })
      .where(eq(connectedAccounts.id, r.accountId))
      .returning();
    igAccount = { id: acct!.id, externalId: acct!.externalId };
    await setAgent();
  });

  beforeEach(async () => {
    sender = `igsid-${randomUUID()}`;
    ai = new FakeAiClient();
    calendar = new FakeCalendarProvider();
    deps = {
      db: t.db,
      ai,
      config,
      adapters: { meta: null, tiktok: null, mock: new MockChannelAdapter("x".repeat(16)) },
      encryptionKey: KEY,
      calendar,
    };
    await setAgent();
  });

  afterAll(async () => {
    await t?.drop();
  });

  it("califica de a una pregunta, ofrece horarios reales y agenda", async () => {
    const first = await receive("Hola! Vi su publicación");
    expect(first.agent).toMatchObject({ status: "replied", action: "continue" });
    expect((await lastOut(first.conversationId))?.body).toContain(QUESTIONS[0]);
    expect((await lastOut(first.conversationId))?.author).toBe("ai");

    await receive("Unos 20 por mes");
    expect((await lastOut(first.conversationId))?.body).toContain(QUESTIONS[1]);
    expect((await stageOf(first.conversationId)).answers).toMatchObject({
      q1: { answer: "Unos 20 por mes" },
    });

    calendar.busy = [];
    const third = await receive("Lo manejo yo");
    expect(third.agent).toMatchObject({ status: "replied", action: "offer_slots", score: 100 });
    const offer = await lastOut(first.conversationId);
    expect(offer?.body).toMatch(/1\) .+\n2\) .+\n3\) /);
    const qualified = await stageOf(first.conversationId);
    expect(qualified.key).toBe("calificado");
    expect(qualified.score).toBe(100);
    const offered = (qualified.conv.agentState as { offeredSlots: { id: string; start: string }[] })
      .offeredSlots;
    expect(offered).toHaveLength(3);

    const fourth = await receive("El 2 me viene bien");
    expect(fourth.agent).toMatchObject({ status: "replied", action: "booked" });
    expect((await lastOut(first.conversationId))?.body).toMatch(/Quedó agendada/);
    expect(calendar.events).toHaveLength(1);
    expect(calendar.events[0]!.start.toISOString()).toBe(new Date(offered[1]!.start).toISOString());
    const booked = await stageOf(first.conversationId);
    expect(booked.key).toBe("agendado");
    const rows = await t.db
      .select()
      .from(meetings)
      .where(eq(meetings.conversationId, first.conversationId));
    expect(rows).toHaveLength(1);
    const notes = await t.db
      .select()
      .from(notifications)
      .where(eq(notifications.conversationId, first.conversationId));
    expect(notes.map((n) => n.kind)).toEqual(["meeting_booked"]);
    const runs = await t.db
      .select()
      .from(aiRuns)
      .where(and(eq(aiRuns.conversationId, first.conversationId), eq(aiRuns.type, "reply")));
    expect(runs).toHaveLength(4);
    expect(runs.every((r) => r.promptVersion === "agent_reply@v1")).toBe(true);
  });

  it("si preguntan si es un bot, dice la verdad y ofrece una persona", async () => {
    const r = await receive("¿Sos un bot?");
    const out = await lastOut(r.conversationId);
    expect(out?.body).toMatch(/inteligencia artificial/);
    expect(out?.body).toMatch(/persona/);
  });

  it("nunca deja pasar una respuesta que niega ser IA", async () => {
    ai = new FakeAiClient({
      agent_reply: [
        {
          reply: "Jaja no, soy una persona real del equipo.",
          askedIfBot: false,
          handoff: { needed: false, reason: null, summary: "" },
          answers: [],
          criteria: [],
          wantsMeeting: false,
          selectedSlotId: null,
        },
      ],
    });
    deps.ai = ai;
    const r = await receive("¿Hablo con alguien?");
    const out = await lastOut(r.conversationId);
    expect(out?.body).not.toMatch(/soy una persona real/);
    expect(out?.body).toMatch(/inteligencia artificial/);
  });

  it("si piden una persona: pausa la IA, avisa al equipo y no gasta IA", async () => {
    const r = await receive("Quiero hablar con una persona por favor");
    expect(r.agent).toMatchObject({ action: "handoff" });
    expect(ai.calls).toHaveLength(0);
    const { conv } = await stageOf(r.conversationId);
    expect(conv.aiPaused).toBe(true);
    expect(conv.aiPausedReason).toMatch(/pidió hablar con una persona/);
    const notes = await t.db
      .select()
      .from(notifications)
      .where(eq(notifications.conversationId, r.conversationId));
    expect(notes).toMatchObject([{ kind: "handoff", link: `/bandeja/${r.conversationId}` }]);

    // Con la IA pausada, los mensajes siguientes no se responden solos.
    const before = mockOutbox.length;
    await receive("¿Hola?", { runAgent: false });
    expect(
      await t.db
        .select()
        .from(jobs)
        .where(and(eq(jobs.type, AGENT_JOB), eq(jobs.status, "queued"))),
    ).toHaveLength(0);
    expect(mockOutbox.length).toBe(before);

    // Reanudar programa la respuesta al mensaje pendiente.
    await resumeAgent(t.db, { organizationId: orgId, conversationId: r.conversationId });
    expect(await runAgent()).toMatchObject({ status: "replied" });
  });

  it("enojo detectado por la IA → handoff", async () => {
    const r = await receive("Esto es una estafa, basta de escribirme");
    expect(r.agent).toMatchObject({ action: "handoff" });
    expect((await stageOf(r.conversationId)).conv.aiPausedReason).toMatch(/molesto/);
  });

  it("puntaje bajo al terminar las preguntas → pasa a una persona", async () => {
    const r1 = await receive("Hola");
    await receive("Unos 2 por mes");
    ai = new FakeAiClient({
      agent_reply: [
        {
          reply: "¡Gracias por contarme!",
          askedIfBot: false,
          handoff: { needed: false, reason: null, summary: "" },
          answers: [{ question: 2, answer: "Mi socio" }],
          criteria: [
            { criterion: 1, met: false, evidence: "Sin presupuesto" },
            { criterion: 2, met: false, evidence: "No decide" },
          ],
          wantsMeeting: false,
          selectedSlotId: null,
        },
      ],
    });
    deps.ai = ai;
    const r3 = await receive("Lo decide mi socio, no tenemos presupuesto");
    expect(r3.agent).toMatchObject({ action: "handoff", score: 0 });
    const s = await stageOf(r1.conversationId);
    expect(s.conv.aiPausedReason).toMatch(/puntaje/);
  });

  it("debounce: con dos mensajes seguidos responde una sola vez, al último", async () => {
    const a = await receive("Hola", { runAgent: false });
    await receive("¿Están?", { runAgent: false });
    const first = await runAgent();
    const second = await runAgent();
    const results = [first, second].map((x) => x?.status);
    expect(results.sort()).toEqual(["replied", "skipped"]);
    const outs = await t.db
      .select()
      .from(messages)
      .where(and(eq(messages.conversationId, a.conversationId), eq(messages.direction, "out")));
    expect(outs).toHaveLength(1);
  });

  it("con la ventana vencida no llama a la IA ni envía", async () => {
    const r = await receive("Hola", { runAgent: false });
    deps.now = new Date(Date.now() + 25 * 3_600_000);
    expect(await runAgent()).toMatchObject({ status: "skipped", reason: "ventana expired" });
    expect(ai.calls).toHaveLength(0);
    expect(await lastOut(r.conversationId)).toBeUndefined();
  });

  it("error no reintentable de la IA → handoff y ai_run con error", async () => {
    ai = new FakeAiClient({ agent_reply: [new AiError("refusal", "rechazo", false, "fake")] });
    deps.ai = ai;
    const r = await receive("Hola");
    expect(r.agent).toMatchObject({ status: "not_sent", action: "handoff" });
    const [run] = await t.db
      .select()
      .from(aiRuns)
      .where(eq(aiRuns.conversationId, r.conversationId));
    expect(run).toMatchObject({ status: "error", type: "reply" });
  });

  it("la demora queda dentro del rango configurado", async () => {
    await setAgent({ replyDelayMinSeconds: 60, replyDelayMaxSeconds: 120 });
    const before = Date.now();
    await receive("Hola", { runAgent: false });
    const [job] = await t.db
      .select()
      .from(jobs)
      .where(and(eq(jobs.type, AGENT_JOB), eq(jobs.status, "queued")))
      .orderBy(desc(jobs.createdAt))
      .limit(1);
    const delay = (job!.runAt.getTime() - before) / 1000;
    expect(delay).toBeGreaterThanOrEqual(59);
    expect(delay).toBeLessThanOrEqual(122);
    await t.db.delete(jobs).where(eq(jobs.id, job!.id));
  });

  it("con el agente apagado no se programa nada", async () => {
    await setAgent({ enabled: false });
    await receive("Hola", { runAgent: false });
    expect(
      await t.db
        .select()
        .from(jobs)
        .where(and(eq(jobs.type, AGENT_JOB), eq(jobs.status, "queued"))),
    ).toHaveLength(0);
  });
});
