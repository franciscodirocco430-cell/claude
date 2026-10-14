import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  draftMessagePrompt,
  promptRef,
  researchProspectPrompt,
  type CampaignContext,
  type ProspectContext,
  type WebsiteContext,
} from "@prompts/index";
import type { Database } from "@/db/client";
import {
  campaigns,
  outreachTasks,
  prospectHandles,
  prospects,
  researchNotes,
  suppressionList,
  type ResearchSource,
} from "@/db/schema";
import type { Channel } from "@/server/compliance/channels";
import { composeEmailBody } from "@/server/email/compose";
import { enqueueJob, PermanentJobError, type Job } from "@/server/jobs/queue";
import type { WebsiteFetcher } from "@/server/research/website";
import { CHANNEL_RULES, validateDraft } from "./channel-rules";
import { AiError, type AiClient } from "./client";
import type { AiConfig } from "./config";
import { recordAiRun } from "./runs";
import {
  emailDraftSchema,
  normalizeResearch,
  researchOutputSchema,
  socialDraftSchema,
} from "./schemas";

export const RESEARCH_JOB = "research_prospect";
export const DRAFT_JOB = "draft_message";

export interface PipelineDeps {
  db: Database;
  ai: AiClient;
  config: AiConfig;
  fetcher: WebsiteFetcher;
}

const researchPayload = z.object({ organizationId: z.uuid(), prospectId: z.uuid() });
const draftPayload = z.object({
  organizationId: z.uuid(),
  prospectId: z.uuid(),
  channel: z.enum(["instagram", "facebook", "tiktok", "whatsapp", "email"]),
  researchNoteId: z.uuid().nullable(),
});

function parsePayload<S extends z.ZodType>(schema: S, job: Job): z.infer<S> {
  const parsed = schema.safeParse(job.payload);
  if (!parsed.success) throw new PermanentJobError("Payload inválido.");
  // El job tiene que pertenecer a la misma organización que dice su payload.
  if (job.organizationId !== (parsed.data as { organizationId: string }).organizationId) {
    throw new PermanentJobError("El job no coincide con la organización del payload.");
  }
  return parsed.data;
}

async function loadBundle(db: Database, organizationId: string, prospectId: string) {
  const [row] = await db
    .select({ prospect: prospects, campaign: campaigns })
    .from(prospects)
    .leftJoin(
      campaigns,
      and(
        eq(campaigns.id, prospects.campaignId),
        eq(campaigns.organizationId, prospects.organizationId),
      ),
    )
    .where(and(eq(prospects.id, prospectId), eq(prospects.organizationId, organizationId)));
  if (!row) throw new PermanentJobError("El prospecto no existe.");
  if (!row.campaign) throw new PermanentJobError("El prospecto no tiene campaña.");
  const handles = await db
    .select({
      channel: prospectHandles.channel,
      handle: prospectHandles.handle,
      url: prospectHandles.url,
    })
    .from(prospectHandles)
    .where(
      and(
        eq(prospectHandles.prospectId, prospectId),
        eq(prospectHandles.organizationId, organizationId),
      ),
    );
  return { prospect: row.prospect, campaign: row.campaign, handles };
}

type Bundle = Awaited<ReturnType<typeof loadBundle>>;

function campaignContext(c: Bundle["campaign"]): CampaignContext {
  return {
    name: c.name,
    niche: c.niche,
    nicheReferences: c.nicheReferences,
    offer: c.offer,
    icp: c.icp,
    tone: c.tone,
  };
}

function prospectContext(b: Bundle): ProspectContext {
  const p = b.prospect;
  return {
    fullName: p.fullName,
    company: p.company,
    industry: p.industry,
    website: p.website,
    notes: p.notes,
    handles: b.handles.map((h) => ({ channel: h.channel, handle: h.handle })),
  };
}

/** Canales de la campaña por los que se puede contactar a este prospecto. */
export function reachableChannels(
  campaignChannels: readonly Channel[],
  prospect: { email: string | null; phone: string | null },
  handles: readonly { channel: string }[],
): Channel[] {
  return campaignChannels.filter((ch) => {
    if (ch === "email") return !!prospect.email;
    if (ch === "whatsapp") return !!prospect.phone;
    return handles.some((h) => h.channel === ch);
  });
}

async function setStatus(
  db: Database,
  b: { organizationId: string; id: string },
  status: typeof prospects.$inferSelect.aiStatus,
  error: string | null = null,
) {
  await db
    .update(prospects)
    .set({ aiStatus: status, aiError: error })
    .where(and(eq(prospects.id, b.id), eq(prospects.organizationId, b.organizationId)));
}

function describeAiError(error: unknown): string {
  if (error instanceof AiError) return error.message;
  return "Error inesperado al usar la IA.";
}

// ───────────────────────────── Investigación ─────────────────────────────

export async function runResearchJob(deps: PipelineDeps, job: Job) {
  const { organizationId, prospectId } = parsePayload(researchPayload, job);
  const { db } = deps;
  const bundle = await loadBundle(db, organizationId, prospectId);

  // Idempotencia: si un intento anterior ya guardó la nota, solo falta encolar borradores.
  let [note] = await db.select().from(researchNotes).where(eq(researchNotes.jobId, job.id));
  const isRetryAfterNote = !!note;

  if (!note) {
    await setStatus(db, bundle.prospect, "researching");
    const sources: ResearchSource[] = [
      { kind: bundle.prospect.source === "csv" ? "csv" : "user_input" },
    ];
    let website: WebsiteContext | null = null;
    let websiteSkippedReason: string | null = null;
    if (bundle.prospect.website) {
      const result = await deps.fetcher.fetchPage(bundle.prospect.website);
      if (result.ok) {
        website = { url: result.url, ...result.page };
        sources.push({ kind: "website", url: result.url });
      } else {
        websiteSkippedReason = result.reason;
        sources.push({ kind: "website", url: result.url, skippedReason: result.reason });
      }
    }

    const ctx = {
      campaign: campaignContext(bundle.campaign),
      prospect: prospectContext(bundle),
      website,
      websiteSkippedReason,
    };
    const tier = deps.config.fast;
    const inputSummary = `Investigación de ${bundle.prospect.fullName ?? bundle.prospect.company ?? prospectId}: datos cargados${website ? ` + web (${website.text.length} caracteres)` : ""}.`;
    let result;
    try {
      result = await deps.ai.generateStructured({
        tier: "fast",
        task: "research",
        system: researchProspectPrompt.system(ctx),
        user: researchProspectPrompt.user(ctx),
        schema: researchOutputSchema,
        maxTokens: 4000,
      });
    } catch (error) {
      await recordAiRun(db, {
        organizationId,
        type: "research",
        tier,
        model: error instanceof AiError ? error.model : undefined,
        usage: error instanceof AiError ? error.usage : undefined,
        promptVersion: promptRef(researchProspectPrompt),
        inputSummary,
        error: error as Error,
        prospectId,
      });
      const retryable =
        error instanceof AiError && error.retryable && job.attempts < job.maxAttempts;
      await setStatus(
        db,
        bundle.prospect,
        retryable ? "queued" : "error",
        retryable ? null : describeAiError(error),
      );
      if (retryable) throw error;
      throw new PermanentJobError(describeAiError(error));
    }

    const research = normalizeResearch(result.data);
    note = await db.transaction(async (tx) => {
      const aiRunId = await recordAiRun(tx, {
        organizationId,
        type: "research",
        tier,
        model: result.model,
        promptVersion: promptRef(researchProspectPrompt),
        inputSummary,
        output: research,
        usage: result.usage,
        durationMs: result.durationMs,
        prospectId,
      });
      const [inserted] = await tx
        .insert(researchNotes)
        .values({
          organizationId,
          prospectId,
          summary: research.summary,
          pains: research.pains,
          hooks: research.hooks,
          sources,
          aiRunId,
          jobId: job.id,
        })
        .onConflictDoNothing({ target: researchNotes.jobId })
        .returning();
      if (inserted) return inserted;
      const [existing] = await tx
        .select()
        .from(researchNotes)
        .where(eq(researchNotes.jobId, job.id));
      return existing!;
    });
  }

  const channels = reachableChannels(bundle.campaign.channels, bundle.prospect, bundle.handles);
  if (channels.length === 0) {
    await setStatus(
      db,
      bundle.prospect,
      "error",
      "No tiene datos de contacto para ningún canal de la campaña.",
    );
    return;
  }
  // El contador se fija antes de encolar: cada borrador lo descuenta al terminar.
  // En un reintento (la nota ya existía) no se toca: algunos borradores pueden
  // haber terminado y reiniciarlo dejaría al prospecto trabado en "drafting".
  if (!isRetryAfterNote)
    await db
      .update(prospects)
      .set({ aiStatus: "drafting", aiError: null, aiPendingDrafts: channels.length })
      .where(and(eq(prospects.id, prospectId), eq(prospects.organizationId, organizationId)));
  for (const channel of channels) {
    await enqueueJob(db, {
      type: DRAFT_JOB,
      organizationId,
      payload: { organizationId, prospectId, channel, researchNoteId: note.id },
      idempotencyKey: `draft:${note.id}:${channel}`,
    });
  }
}

// ───────────────────────────── Redacción ─────────────────────────────

async function isSuppressed(db: Database, organizationId: string, channel: Channel, b: Bundle) {
  const values: { kind: "email" | "phone" | "handle"; value: string }[] = [];
  if (channel === "email" && b.prospect.email)
    values.push({ kind: "email", value: b.prospect.email });
  if (channel === "whatsapp" && b.prospect.phone)
    values.push({ kind: "phone", value: b.prospect.phone });
  for (const h of b.handles)
    if (h.channel === channel && h.handle) values.push({ kind: "handle", value: h.handle });
  if (values.length === 0) return false;
  const rows = await db
    .select({ id: suppressionList.id })
    .from(suppressionList)
    .where(
      and(
        eq(suppressionList.organizationId, organizationId),
        inArray(
          suppressionList.value,
          values.map((v) => v.value),
        ),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

const MAX_DRAFT_ATTEMPTS = 2;

export async function runDraftJob(deps: PipelineDeps, job: Job) {
  const { organizationId, prospectId, channel, researchNoteId } = parsePayload(draftPayload, job);
  const { db } = deps;
  const bundle = await loadBundle(db, organizationId, prospectId);
  const rule = CHANNEL_RULES[channel];
  const isEmail = channel === "email";

  if (await isSuppressed(db, organizationId, channel, bundle)) {
    await finishDrafting(db, bundle);
    return;
  }

  const [research] = researchNoteId
    ? await db
        .select()
        .from(researchNotes)
        .where(
          and(
            eq(researchNotes.id, researchNoteId),
            eq(researchNotes.organizationId, organizationId),
          ),
        )
    : [];

  const examples = bundle.campaign.fewShotExamples
    .filter((e) => e.channel === channel)
    .slice(0, 3)
    .map((e) => ({ context: e.context, message: e.message }));

  const tier = deps.config.smart;
  let previousErrors: string[] = [];
  let draft: { message: string; subject: string | null; aiRunId: string } | null = null;
  let failure: string | null = null;

  for (let attempt = 1; attempt <= MAX_DRAFT_ATTEMPTS && !draft; attempt++) {
    const ctx = {
      campaign: campaignContext(bundle.campaign),
      prospect: prospectContext(bundle),
      channelLabel: rule.label,
      channelGuidance: rule.guidance,
      maxChars: rule.maxChars,
      isEmail,
      research: research
        ? { summary: research.summary, pains: research.pains, hooks: research.hooks }
        : null,
      examples,
      previousErrors,
    };
    const inputSummary = `Borrador ${rule.label} para ${bundle.prospect.fullName ?? bundle.prospect.company ?? prospectId} (intento ${attempt}).`;
    try {
      const common = {
        tier: "smart" as const,
        task: `draft:${channel}`,
        system: draftMessagePrompt.system(ctx),
        user: draftMessagePrompt.user(ctx),
        maxTokens: 4000,
      };
      const result = isEmail
        ? await deps.ai.generateStructured({ ...common, schema: emailDraftSchema })
        : await deps.ai.generateStructured({ ...common, schema: socialDraftSchema });
      const message = "body" in result.data ? result.data.body : result.data.message;
      const subject = "subject" in result.data ? result.data.subject : null;
      const errors = validateDraft(channel, { message, subject });
      const aiRunId = await recordAiRun(db, {
        organizationId,
        type: "draft",
        tier,
        model: result.model,
        promptVersion: promptRef(draftMessagePrompt),
        inputSummary,
        output: { ...result.data, validationErrors: errors },
        usage: result.usage,
        durationMs: result.durationMs,
        prospectId,
      });
      if (errors.length === 0)
        draft = { message: message.trim(), subject: subject?.trim() ?? null, aiRunId };
      else {
        previousErrors = errors;
        failure = `El borrador no cumplió las reglas del canal: ${errors.join(" ")}`;
      }
    } catch (error) {
      await recordAiRun(db, {
        organizationId,
        type: "draft",
        tier,
        model: error instanceof AiError ? error.model : undefined,
        usage: error instanceof AiError ? error.usage : undefined,
        promptVersion: promptRef(draftMessagePrompt),
        inputSummary,
        error: error as Error,
        prospectId,
      });
      if (error instanceof AiError && error.retryable && job.attempts < job.maxAttempts)
        throw error;
      failure = describeAiError(error);
      break;
    }
  }

  const values = draft
    ? {
        status: "ready" as const,
        draftMessage: isEmail ? composeEmailBody(draft.message) : draft.message,
        draftSubject: draft.subject,
        aiRunId: draft.aiRunId,
        failureReason: null,
      }
    : { status: "failed" as const, draftMessage: null, draftSubject: null, failureReason: failure };

  await db.transaction(async (tx) => {
    // Regenerar reemplaza la tarea abierta; una tarea fallida previa se cierra para no acumular.
    await tx
      .update(outreachTasks)
      .set(values)
      .where(
        and(
          eq(outreachTasks.organizationId, organizationId),
          eq(outreachTasks.prospectId, prospectId),
          eq(outreachTasks.channel, channel),
          inArray(outreachTasks.status, ["pending", "ready", "failed"]),
        ),
      );
    const [existing] = await tx
      .select({ id: outreachTasks.id })
      .from(outreachTasks)
      .where(
        and(
          eq(outreachTasks.organizationId, organizationId),
          eq(outreachTasks.prospectId, prospectId),
          eq(outreachTasks.channel, channel),
          inArray(outreachTasks.status, ["pending", "ready", "failed"]),
        ),
      )
      .limit(1);
    if (!existing) {
      await tx.insert(outreachTasks).values({
        organizationId,
        prospectId,
        campaignId: bundle.campaign.id,
        channel,
        assignedTo: bundle.prospect.ownerId,
        ...values,
      });
    }
  });

  await finishDrafting(db, bundle);
}

/**
 * Descuenta el borrador terminado. El UPDATE atómico serializa a los jobs que
 * terminan a la vez: exactamente el último ve 0 y marca el prospecto como listo.
 * (Mirar la tabla de jobs no alcanza: cada job ve al otro todavía "running".)
 */
async function finishDrafting(db: Database, b: Bundle) {
  const [row] = await db
    .update(prospects)
    .set({ aiPendingDrafts: sql`greatest(${prospects.aiPendingDrafts} - 1, 0)` })
    .where(
      and(eq(prospects.id, b.prospect.id), eq(prospects.organizationId, b.prospect.organizationId)),
    )
    .returning({ pending: prospects.aiPendingDrafts });
  if ((row?.pending ?? 0) > 0) return;
  const failed = await db
    .select({ channel: outreachTasks.channel, reason: outreachTasks.failureReason })
    .from(outreachTasks)
    .where(
      and(
        eq(outreachTasks.organizationId, b.prospect.organizationId),
        eq(outreachTasks.prospectId, b.prospect.id),
        eq(outreachTasks.status, "failed"),
      ),
    );
  await setStatus(
    db,
    b.prospect,
    "ready",
    failed.length
      ? failed.map((f) => `${CHANNEL_RULES[f.channel].label}: ${f.reason}`).join(" · ")
      : null,
  );
}
