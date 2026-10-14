import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  ne,
  not,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { Transaction } from "@/db/rls";
import {
  campaigns,
  conversations,
  leadScores,
  messages,
  organizations,
  outreachTasks,
  pipelineStages,
  prospectHandles,
  prospects,
  researchNotes,
  suppressionList,
} from "@/db/schema";
import { CHANNEL_RULES } from "@/server/ai/channel-rules";
import { SOCIAL_CHANNELS, type SocialChannel } from "@/server/compliance/channels";
import { DomainError } from "@/server/errors";
import { advanceLeadStage } from "@/server/pipeline/stages";
import { buildOpenUrl, startOfDayInZone } from "./open-link";

/** Canales que se envían a mano desde la cola. El email sale automático (Fase 5). */
export const MANUAL_CHANNELS = SOCIAL_CHANNELS;
const BUSY_AI = ["queued", "researching", "drafting"] as const;

interface Scope {
  organizationId: string;
  userId: string;
  timeZone: string;
  now?: Date;
}

export interface QueueCounter {
  campaignId: string;
  campaignName: string;
  channel: SocialChannel;
  sent: number;
  limit: number;
}

async function counters(tx: Transaction, scope: Scope): Promise<QueueCounter[]> {
  const dayStart = startOfDayInZone(scope.now ?? new Date(), scope.timeZone);
  const [active, sent] = await Promise.all([
    tx
      .select({
        id: campaigns.id,
        name: campaigns.name,
        channels: campaigns.channels,
        limits: campaigns.dailyLimits,
      })
      .from(campaigns)
      .where(
        and(eq(campaigns.organizationId, scope.organizationId), eq(campaigns.status, "active")),
      )
      .orderBy(asc(campaigns.name)),
    tx
      .select({
        campaignId: outreachTasks.campaignId,
        channel: outreachTasks.channel,
        n: sql<number>`count(*)::int`,
      })
      .from(outreachTasks)
      .where(
        and(
          eq(outreachTasks.organizationId, scope.organizationId),
          eq(outreachTasks.sentBy, scope.userId),
          eq(outreachTasks.status, "sent_manual"),
          gte(outreachTasks.sentAt, dayStart),
        ),
      )
      .groupBy(outreachTasks.campaignId, outreachTasks.channel),
  ]);
  return active.flatMap((c) =>
    c.channels
      .filter((ch): ch is SocialChannel => (MANUAL_CHANNELS as readonly string[]).includes(ch))
      .map((channel) => ({
        campaignId: c.id,
        campaignName: c.name,
        channel,
        sent: sent.find((s) => s.campaignId === c.id && s.channel === channel)?.n ?? 0,
        limit: c.limits[channel] ?? 0,
      })),
  );
}

/** Condición base de "tarea que se puede trabajar ahora". */
function workable(scope: Scope, blocked: QueueCounter[]): SQL {
  const conds = [
    eq(outreachTasks.organizationId, scope.organizationId),
    eq(outreachTasks.status, "ready"),
    inArray(outreachTasks.channel, [...MANUAL_CHANNELS]),
    eq(campaigns.status, "active"),
    // Mientras la IA regenera el mensaje, la tarea no se muestra.
    notInArray(prospects.aiStatus, [...BUSY_AI]),
  ];
  if (blocked.length) {
    conds.push(
      not(
        or(
          ...blocked.map((b) =>
            and(eq(outreachTasks.campaignId, b.campaignId), eq(outreachTasks.channel, b.channel)),
          ),
        )!,
      ),
    );
  }
  return and(...conds)!;
}

async function findMine(tx: Transaction, scope: Scope, blocked: QueueCounter[]) {
  const [row] = await tx
    .select({ id: outreachTasks.id })
    .from(outreachTasks)
    .innerJoin(
      campaigns,
      and(
        eq(campaigns.id, outreachTasks.campaignId),
        eq(campaigns.organizationId, outreachTasks.organizationId),
      ),
    )
    .innerJoin(
      prospects,
      and(
        eq(prospects.id, outreachTasks.prospectId),
        eq(prospects.organizationId, outreachTasks.organizationId),
      ),
    )
    .where(and(workable(scope, blocked), eq(outreachTasks.assignedTo, scope.userId)))
    .orderBy(asc(outreachTasks.createdAt))
    .limit(1);
  return row?.id ?? null;
}

/** Toma una tarea sin asignar. SKIP LOCKED: dos setters nunca reciben la misma. */
async function claimUnassigned(tx: Transaction, scope: Scope, blocked: QueueCounter[]) {
  const candidate = tx
    .select({ id: outreachTasks.id })
    .from(outreachTasks)
    .innerJoin(
      campaigns,
      and(
        eq(campaigns.id, outreachTasks.campaignId),
        eq(campaigns.organizationId, outreachTasks.organizationId),
      ),
    )
    .innerJoin(
      prospects,
      and(
        eq(prospects.id, outreachTasks.prospectId),
        eq(prospects.organizationId, outreachTasks.organizationId),
      ),
    )
    .where(and(workable(scope, blocked), isNull(outreachTasks.assignedTo)))
    .orderBy(asc(outreachTasks.createdAt))
    .limit(1)
    .for("update", { of: outreachTasks, skipLocked: true });
  const [row] = await tx
    .update(outreachTasks)
    .set({ assignedTo: scope.userId })
    .where(inArray(outreachTasks.id, candidate))
    .returning({ id: outreachTasks.id });
  return row?.id ?? null;
}

async function loadTask(tx: Transaction, organizationId: string, taskId: string) {
  const [row] = await tx
    .select({ task: outreachTasks, prospect: prospects, campaignName: campaigns.name })
    .from(outreachTasks)
    .innerJoin(
      prospects,
      and(
        eq(prospects.id, outreachTasks.prospectId),
        eq(prospects.organizationId, outreachTasks.organizationId),
      ),
    )
    .innerJoin(
      campaigns,
      and(
        eq(campaigns.id, outreachTasks.campaignId),
        eq(campaigns.organizationId, outreachTasks.organizationId),
      ),
    )
    .where(and(eq(outreachTasks.id, taskId), eq(outreachTasks.organizationId, organizationId)));
  if (!row) return null;
  const [handles, [research]] = await Promise.all([
    tx.select().from(prospectHandles).where(eq(prospectHandles.prospectId, row.prospect.id)),
    tx
      .select()
      .from(researchNotes)
      .where(eq(researchNotes.prospectId, row.prospect.id))
      .orderBy(desc(researchNotes.createdAt))
      .limit(1),
  ]);
  return { ...row, handles, research: research ?? null };
}

type LoadedTask = NonNullable<Awaited<ReturnType<typeof loadTask>>>;

async function suppressed(
  tx: Transaction,
  organizationId: string,
  t: LoadedTask,
): Promise<boolean> {
  const channel = t.task.channel;
  const values = [
    ...(channel === "whatsapp" && t.prospect.phone ? [t.prospect.phone] : []),
    ...t.handles.filter((h) => h.channel === channel && h.handle).map((h) => h.handle!),
  ];
  if (!values.length) return false;
  const rows = await tx
    .select({ id: suppressionList.id })
    .from(suppressionList)
    .where(
      and(
        eq(suppressionList.organizationId, organizationId),
        inArray(suppressionList.value, values),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export interface QueueState {
  counters: QueueCounter[];
  task: {
    id: string;
    channel: SocialChannel;
    message: string;
    maxChars: number;
    openUrl: string | null;
    campaignId: string;
    campaignName: string;
    prospect: {
      id: string;
      name: string;
      company: string | null;
      phone: string | null;
      handles: { channel: string; handle: string | null; url: string | null }[];
    };
    research: { summary: string; hooks: string[]; pains: string[] } | null;
  } | null;
  /** Hay tareas listas pero todas en canales que llegaron al tope de hoy. */
  limitReached: boolean;
}

/** Próxima tarea del setter (asignadas primero; si no, toma una libre) + contadores del día. */
export async function getQueueState(tx: Transaction, scope: Scope): Promise<QueueState> {
  const list = await counters(tx, scope);
  const blocked = list.filter((c) => c.sent >= c.limit);

  for (let guard = 0; guard < 20; guard++) {
    const id = (await findMine(tx, scope, blocked)) ?? (await claimUnassigned(tx, scope, blocked));
    if (!id) break;
    const t = await loadTask(tx, scope.organizationId, id);
    if (!t) break;
    if (await suppressed(tx, scope.organizationId, t)) {
      await tx
        .update(outreachTasks)
        .set({ status: "skipped", skippedReason: "En lista de supresión." })
        .where(eq(outreachTasks.id, id));
      continue;
    }
    const channel = t.task.channel as SocialChannel;
    const message = t.task.draftMessage ?? "";
    return {
      counters: list,
      limitReached: false,
      task: {
        id,
        channel,
        message,
        maxChars: CHANNEL_RULES[channel].maxChars,
        openUrl: buildOpenUrl(channel, { phone: t.prospect.phone, handles: t.handles }, message),
        campaignId: t.task.campaignId!,
        campaignName: t.campaignName,
        prospect: {
          id: t.prospect.id,
          name: t.prospect.fullName ?? t.prospect.company ?? t.handles[0]?.handle ?? "Prospecto",
          company: t.prospect.fullName ? t.prospect.company : null,
          phone: t.prospect.phone,
          handles: t.handles.map((h) => ({ channel: h.channel, handle: h.handle, url: h.url })),
        },
        research: t.research
          ? { summary: t.research.summary, hooks: t.research.hooks, pains: t.research.pains }
          : null,
      },
    };
  }

  // ¿Quedan tareas listas, pero bloqueadas por el tope?
  let limitReached = false;
  if (blocked.length) {
    const [row] = await tx
      .select({ id: outreachTasks.id })
      .from(outreachTasks)
      .innerJoin(
        campaigns,
        and(
          eq(campaigns.id, outreachTasks.campaignId),
          eq(campaigns.organizationId, outreachTasks.organizationId),
        ),
      )
      .innerJoin(
        prospects,
        and(
          eq(prospects.id, outreachTasks.prospectId),
          eq(prospects.organizationId, outreachTasks.organizationId),
        ),
      )
      .where(
        and(
          workable(scope, []),
          or(isNull(outreachTasks.assignedTo), eq(outreachTasks.assignedTo, scope.userId)),
        ),
      )
      .limit(1);
    limitReached = !!row;
  }
  return { counters: list, task: null, limitReached };
}

async function lockTask(tx: Transaction, organizationId: string, taskId: string) {
  const [task] = await tx
    .select()
    .from(outreachTasks)
    .where(and(eq(outreachTasks.id, taskId), eq(outreachTasks.organizationId, organizationId)))
    .for("update");
  if (
    !task ||
    task.status !== "ready" ||
    !(MANUAL_CHANNELS as readonly string[]).includes(task.channel)
  ) {
    throw new DomainError("unavailable", "Esta tarea ya no está disponible.");
  }
  return task;
}

/**
 * El setter envió el mensaje desde la app de la red. Registra la conversación y
 * el mensaje saliente (autor: human), mueve el lead a "contactado" y saltea las
 * otras tareas manuales del prospecto (no se le escribe por varios canales a la vez).
 */
export async function markTaskSent(
  tx: Transaction,
  scope: Scope & { taskId: string; message: string },
) {
  const body = scope.message.trim();
  if (!body) throw new DomainError("empty", "El mensaje está vacío.");
  const task = await lockTask(tx, scope.organizationId, scope.taskId);
  const now = scope.now ?? new Date();

  const counter = (await counters(tx, scope)).find(
    (c) => c.campaignId === task.campaignId && c.channel === task.channel,
  );
  if (counter && counter.sent >= counter.limit) {
    throw new DomainError("limit", "Llegaste al tope diario de este canal para esta campaña.");
  }

  await tx
    .update(outreachTasks)
    .set({
      status: "sent_manual",
      sentAt: now,
      sentBy: scope.userId,
      assignedTo: scope.userId,
      draftMessage: body,
    })
    .where(eq(outreachTasks.id, task.id));

  let [conversation] = await tx
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.organizationId, scope.organizationId),
        eq(conversations.prospectId, task.prospectId),
        eq(conversations.channel, task.channel),
      ),
    )
    .orderBy(desc(conversations.createdAt))
    .limit(1);
  if (!conversation) {
    [conversation] = await tx
      .insert(conversations)
      .values({
        organizationId: scope.organizationId,
        prospectId: task.prospectId,
        campaignId: task.campaignId,
        channel: task.channel,
        assignedTo: scope.userId,
      })
      .returning({ id: conversations.id });
  }
  await tx
    .update(conversations)
    .set({
      lastOutboundAt: now,
      businessMessagesSinceInbound: sql`${conversations.businessMessagesSinceInbound} + 1`,
    })
    .where(eq(conversations.id, conversation!.id));
  await tx.insert(messages).values({
    organizationId: scope.organizationId,
    conversationId: conversation!.id,
    direction: "out",
    author: "human",
    body,
    sentByUserId: scope.userId,
    sentAt: now,
  });

  await advanceLeadStage(tx, {
    organizationId: scope.organizationId,
    prospectId: task.prospectId,
    campaignId: task.campaignId,
    to: "contactado",
    from: ["nuevo"],
  });

  await tx
    .update(outreachTasks)
    .set({
      status: "skipped",
      skippedReason: `Ya se contactó por ${CHANNEL_RULES[task.channel].label}.`,
    })
    .where(
      and(
        eq(outreachTasks.organizationId, scope.organizationId),
        eq(outreachTasks.prospectId, task.prospectId),
        inArray(outreachTasks.status, ["pending", "ready"]),
        inArray(outreachTasks.channel, [...MANUAL_CHANNELS]),
        ne(outreachTasks.id, task.id),
      ),
    );
  return { conversationId: conversation!.id };
}

export async function skipTask(
  tx: Transaction,
  scope: Scope & { taskId: string; reason?: string },
) {
  const task = await lockTask(tx, scope.organizationId, scope.taskId);
  await tx
    .update(outreachTasks)
    .set({
      status: "skipped",
      assignedTo: scope.userId,
      skippedReason: scope.reason?.trim().slice(0, 300) || "Salteado por el setter.",
    })
    .where(eq(outreachTasks.id, task.id));
}

/** Etapa actual del lead (para mostrar en la ficha). */
export async function getLeadStage(
  tx: Transaction,
  organizationId: string,
  prospectId: string,
  campaignId: string,
) {
  const [row] = await tx
    .select({ name: pipelineStages.name, key: pipelineStages.key })
    .from(leadScores)
    .innerJoin(pipelineStages, eq(pipelineStages.id, leadScores.stageId))
    .where(
      and(
        eq(leadScores.organizationId, organizationId),
        eq(leadScores.prospectId, prospectId),
        eq(leadScores.campaignId, campaignId),
      ),
    );
  return row ?? { name: "Nuevo", key: "nuevo" };
}

export async function getOrganizationTimeZone(tx: Transaction, organizationId: string) {
  const [row] = await tx
    .select({ tz: organizations.timezone })
    .from(organizations)
    .where(eq(organizations.id, organizationId));
  return row?.tz ?? "America/Argentina/Buenos_Aires";
}
