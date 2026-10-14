import { and, asc, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { DbExecutor } from "@/db/rls";
import {
  campaigns,
  conversations,
  leadScores,
  meetings,
  memberships,
  messages,
  pipelineStages,
  prospectHandles,
  profiles,
  prospects,
} from "@/db/schema";
import { DomainError } from "@/server/errors";
import { parseAgentSettings } from "@/server/agent/settings";
import type { Channel } from "@/server/compliance/channels";
import { getWindowStatus, type WindowStatus } from "@/server/compliance/messaging-window";
import { CHANNEL_LABELS } from "@/server/prospects/profile-url";

export const INBOX_PAGE_SIZE = 50;

/** Nombre visible del contacto con lo que haya. */
export function contactName(p: {
  fullName: string | null;
  company: string | null;
  handle: string | null;
  phone: string | null;
  email: string | null;
  channel: Channel;
}) {
  return (
    p.fullName ??
    p.company ??
    (p.handle ? `@${p.handle}` : null) ??
    p.phone ??
    p.email ??
    `Contacto de ${CHANNEL_LABELS[p.channel]}`
  );
}

const handleFor = sql<string | null>`(
  select ${prospectHandles.handle} from ${prospectHandles}
  where ${prospectHandles.prospectId} = ${conversations.prospectId}
    and ${prospectHandles.channel} = ${conversations.channel}
    and ${prospectHandles.handle} is not null
  limit 1)`;

export const inboxFiltersSchema = z.object({
  canal: z
    .enum(["instagram", "facebook", "tiktok", "whatsapp", "email"])
    .optional()
    .catch(undefined),
  /** uuid de campaña, o "sin" para conversaciones sin campaña. */
  campana: z
    .union([z.uuid(), z.literal("sin")])
    .optional()
    .catch(undefined),
  etapa: z
    .string()
    .regex(/^[a-z_]{1,40}$/)
    .optional()
    .catch(undefined),
  /** "yo", "nadie" o el uuid de un miembro. */
  asignado: z
    .union([z.literal("yo"), z.literal("nadie"), z.uuid()])
    .optional()
    .catch(undefined),
  /** "pausada" = la IA está pausada (necesita una persona). */
  estado: z.literal("pausada").optional().catch(undefined),
  pagina: z.coerce.number().int().min(1).max(1000).optional().catch(undefined),
});
export type InboxFilters = z.infer<typeof inboxFiltersSchema>;

/** Lee los filtros de los searchParams; un valor inválido se ignora (no rompe la página). */
export function parseInboxFilters(params: Record<string, string | string[] | undefined>) {
  const flat = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, (Array.isArray(v) ? v[0] : v) || undefined]),
  );
  return inboxFiltersSchema.parse(flat);
}

/**
 * Conversaciones con al menos un mensaje, la más reciente primero, con filtros por
 * canal, campaña, etapa, asignado y estado de la IA.
 */
export async function listConversations(
  db: DbExecutor,
  organizationId: string,
  opts: { filters?: InboxFilters; userId?: string; now?: Date } = {},
) {
  const now = opts.now ?? new Date();
  const f = opts.filters ?? {};
  const page = f.pagina ?? 1;
  const last = db
    .select({
      conversationId: messages.conversationId,
      body: messages.body,
      direction: messages.direction,
      sentAt: messages.sentAt,
      rn: sql<number>`row_number() over (partition by ${messages.conversationId} order by ${messages.sentAt} desc)`.as(
        "rn",
      ),
    })
    .from(messages)
    .where(eq(messages.organizationId, organizationId))
    .as("last");

  const where: SQL[] = [eq(conversations.organizationId, organizationId)];
  if (f.canal) where.push(eq(conversations.channel, f.canal));
  if (f.campana === "sin") where.push(isNull(conversations.campaignId));
  else if (f.campana) where.push(eq(conversations.campaignId, f.campana));
  if (f.etapa) where.push(eq(pipelineStages.key, f.etapa));
  if (f.asignado === "nadie") where.push(isNull(conversations.assignedTo));
  else if (f.asignado === "yo" && opts.userId)
    where.push(eq(conversations.assignedTo, opts.userId));
  else if (f.asignado && f.asignado !== "yo") where.push(eq(conversations.assignedTo, f.asignado));
  if (f.estado === "pausada") where.push(eq(conversations.aiPaused, true));

  const rows = await db
    .select({
      id: conversations.id,
      channel: conversations.channel,
      prospectId: conversations.prospectId,
      campaignId: conversations.campaignId,
      lastInboundAt: conversations.lastInboundAt,
      businessMessagesSinceInbound: conversations.businessMessagesSinceInbound,
      fullName: prospects.fullName,
      company: prospects.company,
      phone: prospects.phone,
      email: prospects.email,
      handle: handleFor,
      aiPaused: conversations.aiPaused,
      assignedTo: conversations.assignedTo,
      assigneeName: sql<string | null>`coalesce(${profiles.fullName}, ${profiles.email})`,
      campaignName: campaigns.name,
      stageName: pipelineStages.name,
      lastBody: last.body,
      lastDirection: last.direction,
      lastAt: last.sentAt,
    })
    .from(conversations)
    .innerJoin(prospects, eq(prospects.id, conversations.prospectId))
    .innerJoin(last, and(eq(last.conversationId, conversations.id), eq(last.rn, 1)))
    .leftJoin(
      campaigns,
      and(
        eq(campaigns.id, conversations.campaignId),
        eq(campaigns.organizationId, conversations.organizationId),
      ),
    )
    .leftJoin(
      leadScores,
      and(
        eq(leadScores.organizationId, conversations.organizationId),
        eq(leadScores.prospectId, conversations.prospectId),
        sql`${leadScores.campaignId} is not distinct from ${conversations.campaignId}`,
      ),
    )
    .leftJoin(pipelineStages, eq(pipelineStages.id, leadScores.stageId))
    .leftJoin(profiles, eq(profiles.id, conversations.assignedTo))
    .where(and(...where))
    .orderBy(desc(last.sentAt), desc(conversations.id))
    .limit(INBOX_PAGE_SIZE + 1)
    .offset((page - 1) * INBOX_PAGE_SIZE);
  return {
    page,
    hasMore: rows.length > INBOX_PAGE_SIZE,
    items: rows.slice(0, INBOX_PAGE_SIZE).map((r) => ({
      ...r,
      name: contactName(r),
      window: windowOf(r, now),
    })),
  };
}

/** Asigna (o desasigna) una conversación a un miembro de la organización. */
export async function assignConversation(
  db: DbExecutor,
  input: { organizationId: string; conversationId: string; userId: string | null },
) {
  if (input.userId) {
    const [member] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.organizationId, input.organizationId),
          eq(memberships.userId, input.userId),
        ),
      );
    if (!member) throw new DomainError("not_member", "Esa persona no es del equipo.");
  }
  const [row] = await db
    .update(conversations)
    .set({ assignedTo: input.userId })
    .where(
      and(
        eq(conversations.organizationId, input.organizationId),
        eq(conversations.id, input.conversationId),
      ),
    )
    .returning({ id: conversations.id });
  if (!row) throw new DomainError("not_found", "La conversación no existe.");
}

function windowOf(
  r: { channel: Channel; lastInboundAt: Date | null; businessMessagesSinceInbound: number },
  now: Date,
): WindowStatus {
  return getWindowStatus({
    channel: r.channel,
    lastInboundAt: r.lastInboundAt,
    businessMessagesSinceInbound: r.businessMessagesSinceInbound,
    now,
  });
}

export async function getConversation(
  db: DbExecutor,
  organizationId: string,
  conversationId: string,
  now = new Date(),
) {
  const [conv] = await db
    .select({
      id: conversations.id,
      channel: conversations.channel,
      prospectId: conversations.prospectId,
      campaignId: conversations.campaignId,
      lastInboundAt: conversations.lastInboundAt,
      businessMessagesSinceInbound: conversations.businessMessagesSinceInbound,
      fullName: prospects.fullName,
      company: prospects.company,
      phone: prospects.phone,
      email: prospects.email,
      source: prospects.source,
      handle: handleFor,
      aiPaused: conversations.aiPaused,
      aiPausedReason: conversations.aiPausedReason,
      assignedTo: conversations.assignedTo,
      agentSettings: campaigns.agentSettings,
      questions: campaigns.qualificationQuestions,
      criteria: campaigns.qualificationCriteria,
    })
    .from(conversations)
    .innerJoin(prospects, eq(prospects.id, conversations.prospectId))
    .leftJoin(
      campaigns,
      and(
        eq(campaigns.id, conversations.campaignId),
        eq(campaigns.organizationId, conversations.organizationId),
      ),
    )
    .where(
      and(eq(conversations.organizationId, organizationId), eq(conversations.id, conversationId)),
    );
  if (!conv) return null;
  const [lead] = conv.campaignId
    ? await db
        .select({
          score: leadScores.score,
          answers: leadScores.answers,
          stage: pipelineStages.name,
        })
        .from(leadScores)
        .innerJoin(pipelineStages, eq(pipelineStages.id, leadScores.stageId))
        .where(
          and(
            eq(leadScores.organizationId, organizationId),
            eq(leadScores.prospectId, conv.prospectId),
            eq(leadScores.campaignId, conv.campaignId),
          ),
        )
    : [];
  const [meeting] = await db
    .select({ startsAt: meetings.startsAt, htmlLink: meetings.htmlLink })
    .from(meetings)
    .where(and(eq(meetings.organizationId, organizationId), eq(meetings.conversationId, conv.id)))
    .orderBy(desc(meetings.startsAt))
    .limit(1);
  const agentEnabled = conv.agentSettings ? parseAgentSettings(conv.agentSettings).enabled : false;
  const list = await db
    .select({
      id: messages.id,
      direction: messages.direction,
      author: messages.author,
      body: messages.body,
      sentAt: messages.sentAt,
    })
    .from(messages)
    .where(eq(messages.conversationId, conv.id))
    .orderBy(asc(messages.sentAt), asc(messages.createdAt))
    .limit(500);
  const answers = lead?.answers ?? {};
  return {
    ...conv,
    name: contactName(conv),
    window: windowOf(conv, now),
    messages: list,
    agentEnabled,
    lead: lead
      ? {
          score: lead.score,
          stage: lead.stage,
          questions: (conv.questions ?? []).map((q, i) => ({
            text: q,
            answer: answers[`q${i + 1}`]?.answer ?? null,
          })),
          criteria: (conv.criteria ?? []).map((c, i) => ({
            label: c.label,
            met: answers[`c${i + 1}`]?.met ?? null,
          })),
        }
      : null,
    meeting: meeting ?? null,
  };
}

/** Texto corto del estado de la ventana para la UI. */
export function windowLabel(w: WindowStatus, now = new Date()): string | null {
  switch (w.kind) {
    case "not_applicable":
      return null;
    case "open": {
      const hours = Math.max(1, Math.ceil((w.expiresAt.getTime() - now.getTime()) / 3_600_000));
      const cap = w.remainingMessages !== null ? ` · quedan ${w.remainingMessages} mensajes` : "";
      return `Ventana abierta · vence en ${hours} h${cap}`;
    }
    case "closed":
      if (w.reason === "no_inbound") return "Sin mensajes del contacto";
      if (w.reason === "message_cap") return "Tope de mensajes alcanzado: solo tarea manual";
      return "Ventana vencida: solo tarea manual";
  }
}
