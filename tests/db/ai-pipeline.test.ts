import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withUserContext } from "@/db/rls";
import {
  aiRuns,
  campaigns,
  jobs,
  outreachTasks,
  prospects,
  researchNotes,
  suppressionList,
} from "@/db/schema";
import { AiError } from "@/server/ai/client";
import { aiConfigFromEnv } from "@/server/ai/config";
import { FakeAiClient } from "@/server/ai/fake-client";
import {
  DRAFT_JOB,
  RESEARCH_JOB,
  runDraftJob,
  runResearchJob,
  type PipelineDeps,
} from "@/server/ai/pipeline";
import { queueCampaignPreparation, queueDraftRegeneration } from "@/server/ai/preparation";
import { campaignInputSchema, emptyCampaign } from "@/server/campaigns/schemas";
import { createCampaign, changeCampaignStatus } from "@/server/campaigns/service";
import { claimNextJob, completeJob, failJob } from "@/server/jobs/queue";
import { createOrganization } from "@/server/organizations/service";
import { ingestProspects } from "@/server/prospects/ingest";
import type { WebsiteFetcher, WebsiteResult } from "@/server/research/website";
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from "./setup";

const config = aiConfigFromEnv({
  AI_MODEL_FAST: "fake-fast",
  AI_MODEL_SMART: "fake-smart",
  AI_EFFORT_FAST: "low",
  AI_EFFORT_SMART: "medium",
  AI_PRICE_FAST_INPUT_PER_MTOK: 1,
  AI_PRICE_FAST_OUTPUT_PER_MTOK: 5,
  AI_PRICE_SMART_INPUT_PER_MTOK: 4,
  AI_PRICE_SMART_OUTPUT_PER_MTOK: 20,
});

class FakeFetcher implements WebsiteFetcher {
  urls: string[] = [];
  constructor(private result: (url: string) => WebsiteResult) {}
  async fetchPage(url: string) {
    this.urls.push(url);
    return this.result(url);
  }
}

describe.skipIf(!TEST_DATABASE_URL)("pipeline de IA", () => {
  let t: TestDatabase;
  let orgId: string;
  let ownerId: string;
  let campaignId: string;
  let ai: FakeAiClient;
  let fetcher: FakeFetcher;
  let deps: PipelineDeps;

  /** Simula el worker: procesa todos los jobs encolados. */
  async function drain(max = 50) {
    for (let i = 0; i < max; i++) {
      const job = await claimNextJob(t.db, "test", { types: [RESEARCH_JOB, DRAFT_JOB] });
      if (!job) return;
      try {
        await (job.type === RESEARCH_JOB ? runResearchJob : runDraftJob)(deps, job);
        await completeJob(t.db, job);
      } catch (error) {
        await failJob(t.db, job, error, { random: () => 0 });
      }
    }
  }

  async function addProspect(raw: Record<string, string>) {
    const report = await withUserContext(t.db, { sub: ownerId }, (tx) =>
      ingestProspects(tx, {
        organizationId: orgId,
        campaignId,
        source: "manual",
        rows: [{ row: 1, raw }],
      }),
    );
    return report.outcomes[0]!.prospectId!;
  }

  beforeAll(async () => {
    t = await createTestDatabase();
    ownerId = randomUUID();
    await t.db.execute(
      sql`insert into auth.users (id, email) values (${ownerId}, ${`o-${ownerId}@example.com`})`,
    );
    orgId = (await createOrganization(t.db, { userId: ownerId, name: "Org IA" })).id;
    const data = campaignInputSchema.parse({
      ...emptyCampaign(),
      name: "Campaña IA",
      niche: "Clínicas dentales",
      offer: "Captación de pacientes particulares",
      icp: "Clínicas de 2 a 10 sillones",
      qualificationCriteria: [{ label: "Presupuesto", weight: 50 }],
      qualificationQuestions: ["¿Cuántos pacientes?"],
      channels: ["instagram", "whatsapp", "email"],
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
    await t.db
      .update(campaigns)
      .set({
        fewShotExamples: [
          {
            channel: "instagram",
            context: "clínica",
            message: "Hola! Vi su sede nueva. ¿Cómo vienen?",
          },
        ],
      })
      .where(eq(campaigns.id, campaignId));
  });
  afterAll(async () => {
    await t?.drop();
  });
  beforeEach(() => {
    ai = new FakeAiClient();
    fetcher = new FakeFetcher((url) => ({
      ok: true,
      url,
      page: { title: "Clínica", description: null, text: "Implantes y ortodoncia en Palermo." },
    }));
    deps = { db: t.db, ai, config, fetcher };
  });

  it("investiga, redacta por cada canal alcanzable y deja todo auditado", async () => {
    const pid = await addProspect({
      fullName: "Laura",
      company: "Sonrisas Palermo",
      email: "laura@sonrisas.example.com",
      instagram: "sonrisas.palermo",
      website: "https://sonrisas.example.com",
    });
    expect(await queueCampaignPreparation(t.db, { organizationId: orgId, campaignId })).toEqual({
      queued: 1,
    });
    await drain();

    const [p] = await t.db.select().from(prospects).where(eq(prospects.id, pid));
    expect(p).toMatchObject({ aiStatus: "ready", aiError: null });

    const [note] = await t.db.select().from(researchNotes).where(eq(researchNotes.prospectId, pid));
    expect(note?.sources).toEqual([
      { kind: "user_input" },
      { kind: "website", url: "https://sonrisas.example.com" },
    ]);
    expect(fetcher.urls).toEqual(["https://sonrisas.example.com"]);

    const tasks = await t.db.select().from(outreachTasks).where(eq(outreachTasks.prospectId, pid));
    // Sin teléfono no hay WhatsApp: solo Instagram y email.
    expect(tasks.map((x) => x.channel).sort()).toEqual(["email", "instagram"]);
    const email = tasks.find((x) => x.channel === "email")!;
    expect(email.status).toBe("ready");
    expect(email.draftSubject).toBeTruthy();
    expect(email.draftMessage).toContain("{{link_baja}}");

    // El prompt de Instagram llevó el ejemplo de la campaña y la web llegó envuelta.
    const igCall = ai.calls.find((c) => c.task === "draft:instagram")!;
    expect(igCall.user).toContain("Vi su sede nueva");
    const researchCall = ai.calls.find((c) => c.task === "research")!;
    expect(researchCall.user).toContain("<sitio_web>");
    expect(researchCall.tier).toBe("fast");
    expect(igCall.tier).toBe("smart");

    const runs = await t.db.select().from(aiRuns).where(eq(aiRuns.prospectId, pid));
    expect(runs.map((r) => r.type).sort()).toEqual(["draft", "draft", "research"]);
    expect(runs.every((r) => r.status === "ok" && r.promptVersion && r.costUsd !== null)).toBe(
      true,
    );
  });

  it("borradores que terminan a la vez: el último marca el prospecto como listo", async () => {
    const pid = await addProspect({
      company: "Paralelo",
      instagram: "paralelo",
      email: "a@paralelo.example.com",
      phone: "+5491122223333",
    });
    await queueCampaignPreparation(t.db, { organizationId: orgId, campaignId });
    const research = await claimNextJob(t.db, "test", { types: [RESEARCH_JOB] });
    await runResearchJob(deps, research!);
    await completeJob(t.db, research!);
    // Los 3 borradores corren en paralelo, como en el worker con concurrencia.
    const drafts = await Promise.all(
      [1, 2, 3].map(() => claimNextJob(t.db, "test", { types: [DRAFT_JOB] })),
    );
    expect(drafts.every(Boolean)).toBe(true);
    await Promise.all(drafts.map((j) => runDraftJob(deps, j!)));
    await Promise.all(drafts.map((j) => completeJob(t.db, j!)));
    const [p] = await t.db.select().from(prospects).where(eq(prospects.id, pid));
    expect(p).toMatchObject({ aiStatus: "ready", aiPendingDrafts: 0 });
  });

  it("un doble clic no encola dos veces", async () => {
    await addProspect({ fullName: "Doble", instagram: "doble.clic" });
    const [a, b] = await Promise.all([
      queueCampaignPreparation(t.db, { organizationId: orgId, campaignId }),
      queueCampaignPreparation(t.db, { organizationId: orgId, campaignId }),
    ]);
    expect(a.queued + b.queued).toBe(1);
    await drain();
  });

  it("si robots.txt no deja leer la web, investiga igual con los datos cargados", async () => {
    fetcher = new FakeFetcher((url) => ({
      ok: false,
      url,
      reason: "robots.txt no permite leer esta página.",
    }));
    deps = { ...deps, fetcher };
    const pid = await addProspect({
      company: "Sin robots",
      website: "https://norobots.example.com",
      instagram: "norobots",
    });
    await queueCampaignPreparation(t.db, { organizationId: orgId, campaignId });
    await drain();
    const [note] = await t.db.select().from(researchNotes).where(eq(researchNotes.prospectId, pid));
    expect(note?.sources[1]).toMatchObject({ kind: "website", skippedReason: /robots/ });
    expect(ai.calls.find((c) => c.task === "research")!.user).toContain(
      "No se pudo leer: robots.txt",
    );
  });

  it("un borrador que rompe las reglas se reintenta con la corrección y, si insiste, queda fallido", async () => {
    ai = new FakeAiClient({
      "draft:instagram": [
        { message: "Mirá https://agencia.example.com" },
        { message: "Entrá a www.agencia.com" },
      ],
    });
    deps = { ...deps, ai };
    const pid = await addProspect({ company: "Links", instagram: "links.malos" });
    await queueCampaignPreparation(t.db, { organizationId: orgId, campaignId });
    await drain();
    const calls = ai.calls.filter((c) => c.task === "draft:instagram");
    expect(calls).toHaveLength(2);
    expect(calls[1]!.user).toContain("Corregí estos problemas");
    const [task] = await t.db.select().from(outreachTasks).where(eq(outreachTasks.prospectId, pid));
    expect(task).toMatchObject({ status: "failed", draftMessage: null });
    const [p] = await t.db.select().from(prospects).where(eq(prospects.id, pid));
    expect(p?.aiError).toMatch(/link/);
  });

  it("un rechazo de la IA no se reintenta y queda registrado", async () => {
    ai = new FakeAiClient({
      research: [new AiError("refusal", "El modelo rechazó la tarea (x).", false, "fake-fast")],
    });
    deps = { ...deps, ai };
    const pid = await addProspect({ company: "Rechazo", instagram: "rechazo.ia" });
    await queueCampaignPreparation(t.db, { organizationId: orgId, campaignId });
    await drain();
    const [p] = await t.db.select().from(prospects).where(eq(prospects.id, pid));
    expect(p).toMatchObject({ aiStatus: "error", aiError: /rechazó/ });
    const [job] = await t.db
      .select()
      .from(jobs)
      .where(and(eq(jobs.type, RESEARCH_JOB), sql`${jobs.payload} ->> 'prospectId' = ${pid}`));
    expect(job).toMatchObject({ status: "dead", attempts: 1 });
    const [run] = await t.db.select().from(aiRuns).where(eq(aiRuns.prospectId, pid));
    expect(run).toMatchObject({ status: "error", error: /rechazó/ });
  });

  it("un error transitorio se reintenta y termina bien", async () => {
    ai = new FakeAiClient({ research: [new AiError("api", "429", true)] });
    deps = { ...deps, ai };
    const pid = await addProspect({ company: "Transitorio", instagram: "transitorio" });
    await queueCampaignPreparation(t.db, { organizationId: orgId, campaignId });
    await drain();
    const [p] = await t.db.select().from(prospects).where(eq(prospects.id, pid));
    expect(p?.aiStatus).toBe("ready");
  });

  it("no redacta para contactos en la lista de supresión", async () => {
    const pid = await addProspect({
      company: "Suprimido",
      instagram: "suprimido.ig",
      email: "ok@suprimido.example.com",
    });
    await t.db.insert(suppressionList).values({
      organizationId: orgId,
      kind: "handle",
      channel: "instagram",
      value: "suprimido.ig",
      reason: "requested",
    });
    await queueCampaignPreparation(t.db, { organizationId: orgId, campaignId });
    await drain();
    const tasks = await t.db.select().from(outreachTasks).where(eq(outreachTasks.prospectId, pid));
    expect(tasks.map((x) => x.channel)).toEqual(["email"]);
  });

  it("regenerar reemplaza el borrador abierto sin duplicar la tarea", async () => {
    const pid = await addProspect({ company: "Regenerar", instagram: "regenerar" });
    await queueCampaignPreparation(t.db, { organizationId: orgId, campaignId });
    await drain();
    ai = new FakeAiClient({ "draft:instagram": [{ message: "Versión nueva, ¿charlamos?" }] });
    deps = { ...deps, ai };
    await queueDraftRegeneration(t.db, {
      organizationId: orgId,
      prospectId: pid,
      channel: "instagram",
    });
    await expect(
      queueDraftRegeneration(t.db, {
        organizationId: orgId,
        prospectId: pid,
        channel: "instagram",
      }),
    ).rejects.toThrow(/ya está trabajando/);
    await drain();
    const tasks = await t.db.select().from(outreachTasks).where(eq(outreachTasks.prospectId, pid));
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.draftMessage).toBe("Versión nueva, ¿charlamos?");
  });

  it("un job no puede tocar datos de otra organización", async () => {
    const otherOwner = randomUUID();
    await t.db.execute(
      sql`insert into auth.users (id, email) values (${otherOwner}, ${`x-${otherOwner}@example.com`})`,
    );
    const otherOrg = (await createOrganization(t.db, { userId: otherOwner, name: "Otra" })).id;
    const pid = await addProspect({ company: "Ajeno", instagram: "ajeno" });
    // Job de la otra org apuntando a un prospecto de esta: tiene que fallar sin tocar nada.
    await t.db.insert(jobs).values({
      type: RESEARCH_JOB,
      organizationId: otherOrg,
      payload: { organizationId: otherOrg, prospectId: pid },
    });
    await drain();
    const notes = await t.db.select().from(researchNotes).where(eq(researchNotes.prospectId, pid));
    expect(notes).toHaveLength(0);
  });

  it("no prepara campañas pausadas", async () => {
    await withUserContext(t.db, { sub: ownerId }, (tx) =>
      changeCampaignStatus(tx, {
        organizationId: orgId,
        actorRole: "owner",
        id: campaignId,
        action: "pause",
      }),
    );
    await expect(
      queueCampaignPreparation(t.db, { organizationId: orgId, campaignId }),
    ).rejects.toThrow(/Activá/);
    await withUserContext(t.db, { sub: ownerId }, (tx) =>
      changeCampaignStatus(tx, {
        organizationId: orgId,
        actorRole: "owner",
        id: campaignId,
        action: "activate",
      }),
    );
  });
});
