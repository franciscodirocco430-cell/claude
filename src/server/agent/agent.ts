import { and, desc, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { agentReplyPrompt, promptRef, type AgentPromptContext } from "@prompts/index";
import type { Database } from "@/db/client";
import type { DbExecutor } from "@/db/rls";
import {
  campaigns,
  connectedAccounts,
  conversations,
  leadScores,
  meetings,
  messages,
  organizations,
  pipelineStages,
  prospectHandles,
  prospects,
  researchNotes,
  type QualificationAnswers,
} from "@/db/schema";
import { AiError, type AiClient } from "@/server/ai/client";
import type { AiConfig } from "@/server/ai/config";
import { recordAiRun } from "@/server/ai/runs";
import {
  CalendarError,
  calendarEventId,
  type CalendarProvider,
} from "@/server/calendar/google-calendar";
import { findFreeSlots, formatSlot } from "@/server/calendar/slots";
import { sendConversationMessage } from "@/server/channels/outbound";
import type { ChannelAdapters } from "@/server/channels/registry";
import { isSocialChannel } from "@/server/compliance/channels";
import { getWindowStatus } from "@/server/compliance/messaging-window";
import { enqueueJob, PermanentJobError, type Job } from "@/server/jobs/queue";
import { advanceLeadStage } from "@/server/pipeline/stages";
import { CHANNEL_LABELS } from "@/server/prospects/profile-url";
import {
  AGENT_MAX_CHARS,
  asksForHuman,
  asksIfBot,
  enforceHonesty,
  pendingQuestions,
  scoreLead,
  validateAgentReply,
} from "./guards";
import { notify } from "./notifications";
import { agentOutputSchema, type AgentOutput } from "./schemas";
import {
  parseAgentSettings,
  parseAgentState,
  replyDelaySeconds,
  type AgentSettings,
  type AgentState,
  type Slot,
} from "./settings";

export const AGENT_JOB = "agent_reply";

export interface AgentDeps {
  db: Database;
  ai: AiClient;
  config: AiConfig;
  adapters: ChannelAdapters;
  encryptionKey: string;
  calendar: CalendarProvider | null;
  now?: Date;
}

const payloadSchema = z.object({
  organizationId: z.uuid(),
  conversationId: z.uuid(),
  messageId: z.uuid(),
});

const HANDOFF_LABELS: Record<string, string> = {
  asked_human: "pidió hablar con una persona",
  angry: "está molesto",
  out_of_scope: "preguntó algo fuera de alcance",
  score: "el puntaje no alcanza",
  qualified_manual: "calificó pero no hay agenda configurada",
  no_slots: "calificó pero no hay horarios libres",
  ai_error: "la IA no pudo responder",
  other: "situación a revisar",
};

/**
 * Programa la respuesta del agente para un mensaje entrante, con demora
 * aleatoria (ritmo natural). Solo si la campaña tiene el agente activo y la
 * conversación no está pausada. Clave por mensaje: reintentos no duplican.
 */
export async function scheduleAgentReply(
  db: Database,
  input: {
    organizationId: string;
    conversationId: string;
    messageId: string;
    now?: Date;
    random?: () => number;
    /** Para reprogramar el mismo mensaje (ej. al reanudar la IA). */
    keySuffix?: string;
  },
) {
  const [row] = await db
    .select({ conv: conversations, settings: campaigns.agentSettings })
    .from(conversations)
    .innerJoin(
      campaigns,
      and(
        eq(campaigns.id, conversations.campaignId),
        eq(campaigns.organizationId, conversations.organizationId),
      ),
    )
    .where(
      and(
        eq(conversations.organizationId, input.organizationId),
        eq(conversations.id, input.conversationId),
      ),
    );
  if (!row || row.conv.aiPaused || !isSocialChannel(row.conv.channel)) return null;
  const settings = parseAgentSettings(row.settings);
  if (!settings.enabled) return null;
  const delay = replyDelaySeconds(settings, input.random);
  const now = input.now ?? new Date();
  return enqueueJob(db, {
    type: AGENT_JOB,
    organizationId: input.organizationId,
    payload: {
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      messageId: input.messageId,
    },
    runAt: new Date(now.getTime() + delay * 1000),
    idempotencyKey: `agent:${input.messageId}${input.keySuffix ? `:${input.keySuffix}` : ""}`,
    maxAttempts: 4,
  });
}

/** Pausa el agente en una conversación (handoff o a mano). */
export async function pauseAgent(
  db: DbExecutor,
  input: { organizationId: string; conversationId: string; reason: string },
) {
  await db
    .update(conversations)
    .set({ aiPaused: true, aiPausedReason: input.reason.slice(0, 300) })
    .where(
      and(
        eq(conversations.organizationId, input.organizationId),
        eq(conversations.id, input.conversationId),
      ),
    );
}

export type AgentOutcome =
  | { status: "skipped"; reason: string }
  | { status: "replied" | "not_sent"; action: string; score: number };

async function stageIds(db: DbExecutor, organizationId: string) {
  const rows = await db
    .select({ id: pipelineStages.id, key: pipelineStages.key })
    .from(pipelineStages)
    .where(eq(pipelineStages.organizationId, organizationId));
  return new Map(rows.map((r) => [r.key, r.id]));
}

function slotsText(slots: Slot[], timeZone: string) {
  return slots.map((s, i) => `${i + 1}) ${formatSlot(s, timeZone)}`).join("\n");
}

export async function runAgentReplyJob(deps: AgentDeps, job: Job): Promise<AgentOutcome> {
  const parsed = payloadSchema.safeParse(job.payload);
  if (!parsed.success || parsed.data.organizationId !== job.organizationId) {
    throw new PermanentJobError("Payload del agente inválido.");
  }
  const { organizationId, conversationId, messageId } = parsed.data;
  const { db } = deps;
  const now = deps.now ?? new Date();

  const [row] = await db
    .select({
      conv: conversations,
      campaign: campaigns,
      prospect: prospects,
      orgName: organizations.name,
      orgTimeZone: organizations.timezone,
    })
    .from(conversations)
    .innerJoin(organizations, eq(organizations.id, conversations.organizationId))
    .innerJoin(prospects, eq(prospects.id, conversations.prospectId))
    .innerJoin(
      campaigns,
      and(
        eq(campaigns.id, conversations.campaignId),
        eq(campaigns.organizationId, conversations.organizationId),
      ),
    )
    .where(
      and(eq(conversations.organizationId, organizationId), eq(conversations.id, conversationId)),
    );
  if (!row) return { status: "skipped", reason: "sin conversación o sin campaña" };
  const { conv, campaign, prospect } = row;
  if (!isSocialChannel(conv.channel)) return { status: "skipped", reason: "canal sin agente" };
  if (conv.aiPaused) return { status: "skipped", reason: "IA pausada" };
  const settings = parseAgentSettings(campaign.agentSettings);
  if (!settings.enabled) return { status: "skipped", reason: "agente apagado" };

  // Debounce: si llegó otro mensaje después, lo responde el job de ese mensaje.
  const [trigger] = await db
    .select({ id: messages.id, sentAt: messages.sentAt })
    .from(messages)
    .where(and(eq(messages.conversationId, conv.id), eq(messages.id, messageId)));
  if (!trigger) return { status: "skipped", reason: "mensaje inexistente" };
  const [latestIn] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.conversationId, conv.id), eq(messages.direction, "in")))
    .orderBy(desc(messages.sentAt), desc(messages.createdAt))
    .limit(1);
  if (latestIn?.id !== trigger.id) return { status: "skipped", reason: "hay un mensaje más nuevo" };
  // Ya se respondió (una persona, o un intento anterior de este job).
  const [answered] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conv.id),
        eq(messages.direction, "out"),
        gt(messages.sentAt, trigger.sentAt),
      ),
    )
    .limit(1);
  if (answered) return { status: "skipped", reason: "ya respondida" };

  // Con la ventana cerrada no se gasta IA: el envío igual estaría prohibido.
  const window = getWindowStatus({
    channel: conv.channel,
    lastInboundAt: conv.lastInboundAt,
    businessMessagesSinceInbound: conv.businessMessagesSinceInbound,
    now,
  });
  if (window.kind === "closed") return { status: "skipped", reason: `ventana ${window.reason}` };

  const history = (
    await db
      .select({ direction: messages.direction, body: messages.body })
      .from(messages)
      .where(eq(messages.conversationId, conv.id))
      .orderBy(desc(messages.sentAt), desc(messages.createdAt))
      .limit(30)
  ).reverse();
  const lastOutIndex = history.map((m) => m.direction).lastIndexOf("out");
  const unanswered = history
    .slice(lastOutIndex + 1)
    .filter((m) => m.direction === "in")
    .map((m) => m.body)
    .join("\n");

  const [score] = await db
    .select()
    .from(leadScores)
    .where(
      and(
        eq(leadScores.organizationId, organizationId),
        eq(leadScores.prospectId, prospect.id),
        eq(leadScores.campaignId, campaign.id),
      ),
    );
  const answers: QualificationAnswers = { ...(score?.answers ?? {}) };
  const state = parseAgentState(conv.agentState);
  const timeZone = row.orgTimeZone;
  const send = (text: string, action: string, aiRunId: string | null, scoreValue: number) =>
    deliver(deps, {
      organizationId,
      conversationId: conv.id,
      text,
      aiRunId,
      action,
      score: scoreValue,
    });

  // Regla determinista: si pide una persona, no hace falta IA.
  if (asksForHuman(unanswered)) {
    await handoff(db, {
      organizationId,
      conversationId: conv.id,
      reason: "asked_human",
      summary: unanswered,
      prospectName: prospect.fullName ?? prospect.company,
      channelLabel: CHANNEL_LABELS[conv.channel],
    });
    return send(
      "¡Claro! Le aviso a alguien del equipo para que te escriba por acá en breve.",
      "handoff",
      null,
      score?.score ?? 0,
    );
  }

  const handles = await db
    .select({ channel: prospectHandles.channel, handle: prospectHandles.handle })
    .from(prospectHandles)
    .where(eq(prospectHandles.prospectId, prospect.id));
  const [research] = await db
    .select({ summary: researchNotes.summary, pains: researchNotes.pains })
    .from(researchNotes)
    .where(eq(researchNotes.prospectId, prospect.id))
    .orderBy(desc(researchNotes.createdAt))
    .limit(1);

  const questions = campaign.qualificationQuestions;
  const criteria = campaign.qualificationCriteria;
  const pendingBefore = pendingQuestions(questions, answers);
  const offeredSlots = state.offeredSlots.filter((s) => new Date(s.start) > now);

  const ctx: AgentPromptContext = {
    campaign: {
      name: campaign.name,
      niche: campaign.niche,
      nicheReferences: campaign.nicheReferences,
      offer: campaign.offer,
      icp: campaign.icp,
      tone: campaign.tone,
    },
    script: settings.script,
    teamName: row.orgName,
    channelLabel: CHANNEL_LABELS[conv.channel],
    maxChars: AGENT_MAX_CHARS - 100,
    prospect: {
      fullName: prospect.fullName,
      company: prospect.company,
      industry: prospect.industry,
      website: prospect.website,
      notes: prospect.notes,
      handles,
    },
    research: research ? { summary: research.summary, pains: research.pains } : null,
    questions: questions.map((text, i) => ({
      n: i + 1,
      text,
      answer: answers[`q${i + 1}`]?.answer ?? null,
    })),
    criteria: criteria.map((c, i) => ({
      n: i + 1,
      label: c.label,
      description: c.description ?? null,
    })),
    nextQuestion: pendingBefore.length ? pendingBefore[0]! + 1 : null,
    offeredSlots: offeredSlots.map((s) => ({ id: s.id, label: formatSlot(s, timeZone) })),
    history: history.map((m) => ({
      from: m.direction === "in" ? "prospecto" : "nosotros",
      text: m.body,
    })),
    previousErrors: [],
  };

  // ── IA (con un reintento si la forma de la respuesta no pasa la validación) ──
  let output: AgentOutput | null = null;
  let aiRunId: string | null = null;
  const tier = deps.config.smart;
  for (let attempt = 0; attempt < 2 && !output; attempt++) {
    const inputSummary = `Respuesta del agente (${CHANNEL_LABELS[conv.channel]}) a: ${unanswered.slice(0, 300)}`;
    try {
      const result = await deps.ai.generateStructured({
        tier: "smart",
        task: "agent_reply",
        system: agentReplyPrompt.system(ctx),
        user: agentReplyPrompt.user(ctx),
        schema: agentOutputSchema,
        maxTokens: 4000,
      });
      const errors = validateAgentReply(result.data.reply);
      aiRunId = await recordAiRun(db, {
        organizationId,
        type: "reply",
        tier,
        model: result.model,
        promptVersion: promptRef(agentReplyPrompt),
        inputSummary,
        output: { ...result.data, validationErrors: errors },
        usage: result.usage,
        durationMs: result.durationMs,
        prospectId: prospect.id,
        conversationId: conv.id,
      });
      if (errors.length === 0) output = result.data;
      else ctx.previousErrors = errors;
    } catch (error) {
      const aiError = error instanceof AiError ? error : null;
      await recordAiRun(db, {
        organizationId,
        type: "reply",
        tier,
        model: aiError?.model,
        promptVersion: promptRef(agentReplyPrompt),
        inputSummary,
        usage: aiError?.usage,
        error: error instanceof Error ? error : new Error(String(error)),
        prospectId: prospect.id,
        conversationId: conv.id,
      });
      if (aiError?.retryable || !aiError) throw error;
      break;
    }
  }

  if (!output) {
    // La IA no pudo: pasa a una persona en vez de mandar algo dudoso.
    await handoff(db, {
      organizationId,
      conversationId: conv.id,
      reason: "ai_error",
      summary: unanswered,
      prospectName: prospect.fullName ?? prospect.company,
      channelLabel: CHANNEL_LABELS[conv.channel],
    });
    return { status: "not_sent", action: "handoff", score: score?.score ?? 0 };
  }

  // ── Calificación: respuestas, criterios y puntaje (en código) ──
  for (const a of output.answers) {
    if (a.question >= 1 && a.question <= questions.length && a.answer.trim()) {
      answers[`q${a.question}`] = { answer: a.answer.trim().slice(0, 500), met: null };
    }
  }
  const met = new Map<number, boolean | null>();
  criteria.forEach((_, i) => {
    const prev = answers[`c${i + 1}`];
    if (prev) met.set(i, prev.met);
  });
  for (const c of output.criteria) {
    if (c.criterion >= 1 && c.criterion <= criteria.length && c.met !== null) {
      met.set(c.criterion - 1, c.met);
      answers[`c${c.criterion}`] = { answer: c.evidence.trim().slice(0, 500), met: c.met };
    }
  }
  const newScore = scoreLead(criteria, met);
  const stages = await stageIds(db, organizationId);
  await db
    .insert(leadScores)
    .values({
      organizationId,
      prospectId: prospect.id,
      campaignId: campaign.id,
      score: newScore,
      answers,
      stageId: stages.get("respondio")!,
    })
    .onConflictDoUpdate({
      target: [leadScores.organizationId, leadScores.prospectId, leadScores.campaignId],
      set: { score: newScore, answers },
    });

  const askedBot = output.askedIfBot || asksIfBot(unanswered);
  let reply = enforceHonesty(output.reply.trim(), {
    askedIfBot: askedBot,
    teamName: row.orgName,
  }).reply;
  const handoffInput = {
    organizationId,
    conversationId: conv.id,
    prospectName: prospect.fullName ?? prospect.company,
    channelLabel: CHANNEL_LABELS[conv.channel],
  };

  // ── Pase a una persona pedido por la IA ──
  if (output.handoff.needed) {
    await handoff(db, {
      ...handoffInput,
      reason: output.handoff.reason ?? "other",
      summary: output.handoff.summary || unanswered,
    });
    return send(reply, "handoff", aiRunId, newScore);
  }

  const calendarAccountId = await activeCalendar(db, organizationId, settings);
  const newState: AgentState = { ...state, offeredSlots };

  // ── Eligió un horario ofrecido: agendar ──
  const chosen = output.selectedSlotId
    ? offeredSlots.find((s) => s.id === output!.selectedSlotId)
    : undefined;
  if (chosen && calendarAccountId && deps.calendar) {
    const booked = await bookSlot(deps, {
      organizationId,
      calendarAccountId,
      settings,
      timeZone,
      slot: chosen,
      conv,
      campaignId: campaign.id,
      prospect,
      now,
    });
    if (booked.ok) {
      await saveState(db, conv.id, { offeredSlots: [], offeredAt: null });
      return send(
        `¡Listo! Quedó agendada la llamada para el ${formatSlot(chosen, timeZone)} (hora de ${timeZone.split("/").pop()?.replaceAll("_", " ")}). ¡Nos hablamos!`,
        "booked",
        aiRunId,
        newScore,
      );
    }
    // Se ocupó mientras tanto: se ofrecen otros.
    const fresh = booked.alternatives;
    if (fresh.length) {
      await saveState(db, conv.id, { offeredSlots: fresh, offeredAt: now.toISOString() });
      return send(
        `Uy, ese horario se acaba de ocupar. ¿Te sirve alguno de estos?\n${slotsText(fresh, timeZone)}`,
        "reoffer",
        aiRunId,
        newScore,
      );
    }
  }

  // ── Calificación completa ──
  const pendingAfter = pendingQuestions(questions, answers);
  if (pendingAfter.length === 0 && questions.length > 0) {
    if (newScore < settings.qualifyScore) {
      await handoff(db, { ...handoffInput, reason: "score", summary: `Puntaje ${newScore}/100.` });
      return send(reply, "handoff", aiRunId, newScore);
    }
    await advanceLeadStage(db, {
      organizationId,
      prospectId: prospect.id,
      campaignId: campaign.id,
      to: "calificado",
      from: ["nuevo", "contactado", "respondio"],
    });
    const needsOffer = offeredSlots.length === 0 || (output.wantsMeeting && !chosen);
    if (needsOffer) {
      if (calendarAccountId && deps.calendar) {
        const exclude = new Set(offeredSlots.map((s) => s.start));
        const slots = (await availableSlots(deps, calendarAccountId, settings, timeZone, now))
          .filter((s) => !exclude.has(s.start))
          .slice(0, 3)
          .map((s, i) => ({ ...s, id: `h${i + 1}` }));
        if (slots.length) {
          newState.offeredSlots = slots;
          newState.offeredAt = now.toISOString();
          await saveState(db, conv.id, newState);
          reply = `${reply}\n\n¿Te queda bien alguno de estos horarios para una llamada de ${settings.meetingDurationMinutes} minutos?\n${slotsText(slots, timeZone)}`;
          return send(reply, "offer_slots", aiRunId, newScore);
        }
        await handoff(db, {
          ...handoffInput,
          reason: "no_slots",
          summary: `Puntaje ${newScore}/100.`,
        });
        return send(reply, "handoff", aiRunId, newScore);
      }
      if (campaign.bookingUrl) {
        reply = `${reply}\n\nPodés elegir el horario que te quede mejor acá: ${campaign.bookingUrl}`;
        return send(reply, "booking_link", aiRunId, newScore);
      }
      await handoff(db, {
        ...handoffInput,
        reason: "qualified_manual",
        summary: `Puntaje ${newScore}/100.`,
      });
      return send(reply, "handoff", aiRunId, newScore);
    }
  }

  return send(reply, "continue", aiRunId, newScore);
}

async function deliver(
  deps: AgentDeps,
  input: {
    organizationId: string;
    conversationId: string;
    text: string;
    aiRunId: string | null;
    action: string;
    score: number;
  },
): Promise<AgentOutcome> {
  const result = await sendConversationMessage(
    { db: deps.db, adapters: deps.adapters, encryptionKey: deps.encryptionKey, now: deps.now },
    {
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      text: input.text.slice(0, AGENT_MAX_CHARS + 400),
      author: "ai",
      aiRunId: input.aiRunId,
    },
  );
  return {
    status: result.status === "sent" ? "replied" : "not_sent",
    action: input.action,
    score: input.score,
  };
}

async function handoff(
  db: Database,
  input: {
    organizationId: string;
    conversationId: string;
    reason: string;
    summary: string;
    prospectName: string | null;
    channelLabel: string;
  },
) {
  const label = HANDOFF_LABELS[input.reason] ?? HANDOFF_LABELS.other!;
  await pauseAgent(db, {
    organizationId: input.organizationId,
    conversationId: input.conversationId,
    reason: `La IA pasó la conversación a una persona: ${label}.`,
  });
  await notify(db, {
    organizationId: input.organizationId,
    kind: "handoff",
    title: `${input.prospectName ?? "Un contacto"} necesita una persona (${input.channelLabel})`,
    body: `Motivo: ${label}. ${input.summary}`.slice(0, 1000),
    conversationId: input.conversationId,
  });
}

async function saveState(db: Database, conversationId: string, state: AgentState) {
  await db
    .update(conversations)
    .set({ agentState: state })
    .where(eq(conversations.id, conversationId));
}

/** Calendario configurado en la campaña, si sigue conectado y activo. */
async function activeCalendar(db: Database, organizationId: string, settings: AgentSettings) {
  if (!settings.calendarAccountId) return null;
  const [acct] = await db
    .select({ id: connectedAccounts.id })
    .from(connectedAccounts)
    .where(
      and(
        eq(connectedAccounts.organizationId, organizationId),
        eq(connectedAccounts.id, settings.calendarAccountId),
        eq(connectedAccounts.status, "active"),
        sql`${connectedAccounts.settings}->>'kind' = 'calendar'`,
      ),
    );
  return acct?.id ?? null;
}

async function availableSlots(
  deps: AgentDeps,
  calendarAccountId: string,
  settings: AgentSettings,
  timeZone: string,
  now: Date,
) {
  const to = new Date(now.getTime() + (settings.bookingWindowDays + 1) * 86_400_000);
  const busy = await deps.calendar!.listBusy(calendarAccountId, now, to);
  return findFreeSlots(
    {
      timeZone,
      durationMinutes: settings.meetingDurationMinutes,
      startHour: settings.meetingStartHour,
      endHour: settings.meetingEndHour,
      days: settings.meetingDays,
      minNoticeHours: settings.minNoticeHours,
      windowDays: settings.bookingWindowDays,
    },
    busy,
    now,
    6,
  );
}

async function bookSlot(
  deps: AgentDeps,
  input: {
    organizationId: string;
    calendarAccountId: string;
    settings: AgentSettings;
    timeZone: string;
    slot: Slot;
    conv: typeof conversations.$inferSelect;
    campaignId: string;
    prospect: typeof prospects.$inferSelect;
    now: Date;
  },
): Promise<{ ok: true } | { ok: false; alternatives: Slot[] }> {
  const { db } = deps;
  const start = new Date(input.slot.start);
  const end = new Date(input.slot.end);
  const eventId = calendarEventId(`${input.conv.id}:${input.slot.start}`);

  // ¿Ya se agendó (reintento)? Entonces no se vuelve a crear.
  const [existing] = await db
    .select({ id: meetings.id })
    .from(meetings)
    .where(
      and(eq(meetings.organizationId, input.organizationId), eq(meetings.externalEventId, eventId)),
    );
  if (!existing) {
    const busy = await deps.calendar!.listBusy(input.calendarAccountId, start, end);
    if (busy.some((b) => b.start < end && start < b.end)) {
      const alternatives = (
        await availableSlots(
          deps,
          input.calendarAccountId,
          input.settings,
          input.timeZone,
          input.now,
        )
      )
        .filter((s) => s.start !== input.slot.start)
        .slice(0, 3)
        .map((s, i) => ({ ...s, id: `h${i + 1}` }));
      return { ok: false, alternatives };
    }
    const [handle] = await db
      .select({ handle: prospectHandles.handle })
      .from(prospectHandles)
      .where(
        and(
          eq(prospectHandles.prospectId, input.prospect.id),
          eq(prospectHandles.channel, input.conv.channel),
        ),
      )
      .limit(1);
    const name =
      input.prospect.fullName ??
      input.prospect.company ??
      (handle?.handle ? `@${handle.handle}` : "prospecto");
    let event;
    try {
      event = await deps.calendar!.createEvent(input.calendarAccountId, {
        eventId,
        summary: input.settings.meetingTitle.replaceAll("{{nombre}}", name).slice(0, 200),
        description: `Agendada por el asistente de IA desde ${CHANNEL_LABELS[input.conv.channel]}.\nProspecto: ${name}${input.prospect.phone ? `\nTeléfono: ${input.prospect.phone}` : ""}${input.prospect.email ? `\nEmail: ${input.prospect.email}` : ""}`,
        start,
        end,
        timeZone: input.timeZone,
        attendeeEmail: input.prospect.email,
      });
    } catch (error) {
      if (error instanceof CalendarError && !error.retryable) {
        throw new PermanentJobError(error.message);
      }
      throw error;
    }
    await db
      .insert(meetings)
      .values({
        organizationId: input.organizationId,
        prospectId: input.prospect.id,
        conversationId: input.conv.id,
        campaignId: input.campaignId,
        calendarAccountId: input.calendarAccountId,
        externalEventId: event.id,
        htmlLink: event.htmlLink,
        startsAt: start,
        endsAt: end,
      })
      .onConflictDoNothing();
    await notify(db, {
      organizationId: input.organizationId,
      kind: "meeting_booked",
      title: `Reunión agendada con ${name}`,
      body: formatSlot(input.slot, input.timeZone),
      conversationId: input.conv.id,
    });
  }
  await advanceLeadStage(db, {
    organizationId: input.organizationId,
    prospectId: input.prospect.id,
    campaignId: input.campaignId,
    to: "agendado",
    from: ["nuevo", "contactado", "respondio", "calificado"],
  });
  return { ok: true };
}

/** Reanuda el agente; si quedó un mensaje del prospecto sin responder, lo programa. */
export async function resumeAgent(
  db: Database,
  input: { organizationId: string; conversationId: string; now?: Date },
) {
  await db
    .update(conversations)
    .set({ aiPaused: false, aiPausedReason: null })
    .where(
      and(
        eq(conversations.organizationId, input.organizationId),
        eq(conversations.id, input.conversationId),
      ),
    );
  const [last] = await db
    .select({ id: messages.id, direction: messages.direction })
    .from(messages)
    .where(eq(messages.conversationId, input.conversationId))
    .orderBy(desc(messages.sentAt), desc(messages.createdAt))
    .limit(1);
  if (last?.direction !== "in") return null;
  return scheduleAgentReply(db, {
    organizationId: input.organizationId,
    conversationId: input.conversationId,
    messageId: last.id,
    now: input.now,
    keySuffix: `resume-${(input.now ?? new Date()).getTime()}`,
  });
}
