import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import type { Transaction } from "@/db/rls";
import {
  connectedAccounts,
  conversations,
  messages,
  outreachTasks,
  prospectHandles,
  prospects,
  sequenceEnrollments,
} from "@/db/schema";
import { enqueueJob, PermanentJobError, type Job } from "@/server/jobs/queue";
import { advanceLeadStage } from "@/server/pipeline/stages";
import { normalizeHandle, normalizePhone } from "@/server/prospects/normalize";
import { CHANNEL_LABELS } from "@/server/prospects/profile-url";
import { inboundMessageSchema, type InboundMessage } from "./types";

export const INBOUND_JOB = "receive_inbound_message";

/** Tolerancia para relojes adelantados del proveedor. */
const MAX_FUTURE_MS = 5 * 60_000;

/**
 * Encola cada mensaje entrante. El webhook responde rápido y el trabajo pesado
 * lo hace el worker. La clave de idempotencia es el id del mensaje en la
 * plataforma: los proveedores reintentan y un mismo mensaje llega varias veces.
 */
export async function enqueueInboundMessages(db: Database, list: InboundMessage[]) {
  for (const msg of list) {
    await enqueueJob(db, {
      type: INBOUND_JOB,
      payload: msg,
      idempotencyKey: `inbound:${msg.mock ? "mock" : msg.provider}:${msg.channel}:${msg.externalMessageId}`,
      maxAttempts: 8,
    });
  }
}

export type InboundOutcome =
  | { status: "unknown_account" }
  | { status: "duplicate"; conversationId: string }
  | { status: "stored"; conversationId: string; prospectId: string; createdProspect: boolean };

/** Id estable de la conversación: la cuenta del negocio + el remitente. */
export function threadIdFor(msg: Pick<InboundMessage, "accountExternalId" | "senderId">) {
  return `${msg.accountExternalId}:${msg.senderId}`;
}

/**
 * Guarda un mensaje entrante y lo asocia al prospecto:
 * 1. conversación existente con ese remitente;
 * 2. prospecto con el mismo handle (Instagram/TikTok/Facebook) o teléfono (WhatsApp);
 * 3. si no existe, se crea (fuente "inbound").
 *
 * Además: el lead pasa a "respondió", se saltean sus tareas manuales abiertas
 * (ya escribió él) y se frenan sus secuencias de email. Idempotente.
 */
export async function receiveInboundMessage(
  db: Database,
  msg: InboundMessage,
  now = new Date(),
): Promise<InboundOutcome> {
  const [account] = await db
    .select({ id: connectedAccounts.id, organizationId: connectedAccounts.organizationId })
    .from(connectedAccounts)
    .where(
      and(
        eq(connectedAccounts.provider, msg.provider),
        eq(connectedAccounts.channel, msg.channel),
        eq(connectedAccounts.externalId, msg.accountExternalId),
        eq(connectedAccounts.status, "active"),
        // Un webhook mock solo llega a cuentas de prueba y uno real solo a cuentas reales.
        msg.mock
          ? sql`${connectedAccounts.settings}->>'mock' = 'true'`
          : sql`coalesce(${connectedAccounts.settings}->>'mock', 'false') <> 'true'`,
      ),
    );
  if (!account) return { status: "unknown_account" };
  const organizationId = account.organizationId;
  const threadId = threadIdFor(msg);
  const sentAtRaw = new Date(msg.sentAt);
  const sentAt = sentAtRaw.getTime() > now.getTime() + MAX_FUTURE_MS ? now : sentAtRaw;

  return db.transaction(async (tx) => {
    // Serializa los mensajes del mismo remitente: dos mensajes simultáneos de alguien
    // nuevo no crean dos prospectos.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`${organizationId}:${msg.channel}:${threadId}`}, 0))`,
    );

    let [conv] = await tx
      .select({
        id: conversations.id,
        prospectId: conversations.prospectId,
        campaignId: conversations.campaignId,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.organizationId, organizationId),
          eq(conversations.channel, msg.channel),
          eq(conversations.externalThreadId, threadId),
        ),
      );

    let createdProspect = false;
    if (!conv) {
      let prospect = await matchProspect(tx, organizationId, msg);
      if (!prospect) {
        prospect = await createInboundProspect(tx, organizationId, msg);
        createdProspect = true;
      }
      // Si el setter ya le escribió a mano (Fase 4), esa conversación todavía no
      // tiene id de la plataforma: se reutiliza en vez de abrir otra.
      const [manual] = await tx
        .select({ id: conversations.id, campaignId: conversations.campaignId })
        .from(conversations)
        .where(
          and(
            eq(conversations.organizationId, organizationId),
            eq(conversations.prospectId, prospect.id),
            eq(conversations.channel, msg.channel),
            isNull(conversations.externalThreadId),
          ),
        )
        .orderBy(desc(conversations.createdAt))
        .limit(1);
      if (manual) {
        await tx
          .update(conversations)
          .set({ externalThreadId: threadId, connectedAccountId: account.id })
          .where(eq(conversations.id, manual.id));
        conv = { id: manual.id, prospectId: prospect.id, campaignId: manual.campaignId };
      } else {
        const [created] = await tx
          .insert(conversations)
          .values({
            organizationId,
            prospectId: prospect.id,
            campaignId: prospect.campaignId,
            channel: msg.channel,
            connectedAccountId: account.id,
            externalThreadId: threadId,
          })
          .returning({
            id: conversations.id,
            prospectId: conversations.prospectId,
            campaignId: conversations.campaignId,
          });
        conv = created!;
      }
    }

    const [inserted] = await tx
      .insert(messages)
      .values({
        organizationId,
        conversationId: conv.id,
        direction: "in",
        author: "prospect",
        body: msg.text,
        externalId: msg.externalMessageId,
        sentAt,
      })
      .onConflictDoNothing({ target: [messages.conversationId, messages.externalId] })
      .returning({ id: messages.id });
    if (!inserted) return { status: "duplicate", conversationId: conv.id };

    const sentAtSql = sql`${sentAt.toISOString()}::timestamptz`;
    // La ventana corre desde el último mensaje del usuario; un mensaje viejo que
    // llega tarde (reintento del proveedor) no la reabre ni resetea el contador.
    await tx
      .update(conversations)
      .set({
        lastInboundAt: sql`greatest(${conversations.lastInboundAt}, ${sentAtSql})`,
        businessMessagesSinceInbound: sql`case when ${conversations.lastInboundAt} is null or ${conversations.lastInboundAt} <= ${sentAtSql} then 0 else ${conversations.businessMessagesSinceInbound} end`,
        connectedAccountId: account.id,
      })
      .where(eq(conversations.id, conv.id));

    await advanceLeadStage(tx, {
      organizationId,
      prospectId: conv.prospectId,
      campaignId: conv.campaignId,
      to: "respondio",
      from: ["nuevo", "contactado"],
    });

    // Ya escribió él: no se le manda un "primer mensaje" por ningún canal.
    await tx
      .update(outreachTasks)
      .set({
        status: "skipped",
        skippedReason: `El prospecto escribió por ${CHANNEL_LABELS[msg.channel]}.`,
      })
      .where(
        and(
          eq(outreachTasks.organizationId, organizationId),
          eq(outreachTasks.prospectId, conv.prospectId),
          inArray(outreachTasks.status, ["pending", "ready"]),
        ),
      );

    // Respondió por otro canal: las secuencias de email se frenan igual.
    await tx
      .update(sequenceEnrollments)
      .set({
        status: "stopped_replied",
        stopReason: `Respondió por ${CHANNEL_LABELS[msg.channel]}.`,
        stoppedAt: now,
        nextSendAt: null,
      })
      .where(
        and(
          eq(sequenceEnrollments.organizationId, organizationId),
          eq(sequenceEnrollments.prospectId, conv.prospectId),
          eq(sequenceEnrollments.status, "active"),
        ),
      );

    return {
      status: "stored",
      conversationId: conv.id,
      prospectId: conv.prospectId,
      createdProspect,
    };
  });
}

async function matchProspect(tx: Transaction, organizationId: string, msg: InboundMessage) {
  const cols = { id: prospects.id, campaignId: prospects.campaignId };
  const handle = normalizeHandle(msg.senderHandle);
  if (handle) {
    const [byHandle] = await tx
      .select(cols)
      .from(prospectHandles)
      .innerJoin(prospects, eq(prospects.id, prospectHandles.prospectId))
      .where(
        and(
          eq(prospectHandles.organizationId, organizationId),
          eq(prospectHandles.channel, msg.channel),
          eq(prospectHandles.handle, handle),
        ),
      )
      .limit(1);
    if (byHandle) return byHandle;
  }
  const phone = normalizePhone(msg.senderPhone);
  if (phone) {
    const [byPhone] = await tx
      .select(cols)
      .from(prospects)
      .where(and(eq(prospects.organizationId, organizationId), eq(prospects.phone, phone)))
      .limit(1);
    if (byPhone) return byPhone;
  }
  return null;
}

async function createInboundProspect(tx: Transaction, organizationId: string, msg: InboundMessage) {
  const handle = normalizeHandle(msg.senderHandle);
  const [created] = await tx
    .insert(prospects)
    .values({
      organizationId,
      fullName: msg.senderName?.trim() || null,
      phone: normalizePhone(msg.senderPhone),
      source: "inbound",
      sourceRef: `${msg.channel}:${msg.accountExternalId}`,
    })
    .returning({ id: prospects.id, campaignId: prospects.campaignId });
  if (handle) {
    await tx
      .insert(prospectHandles)
      .values({ organizationId, prospectId: created!.id, channel: msg.channel, handle })
      .onConflictDoNothing();
  }
  await advanceLeadStage(tx, {
    organizationId,
    prospectId: created!.id,
    campaignId: null,
    to: "nuevo",
    from: [],
  });
  return created!;
}

/** Handler del worker. */
export async function runInboundJob(db: Database, job: Job) {
  const parsed = inboundMessageSchema.safeParse(job.payload);
  if (!parsed.success) throw new PermanentJobError("Payload de mensaje entrante inválido.");
  const outcome = await receiveInboundMessage(db, parsed.data);
  // Cuenta desconectada o de otro entorno: queda registrado como job muerto.
  if (outcome.status === "unknown_account") {
    throw new PermanentJobError(
      `Mensaje para una cuenta no conectada (${parsed.data.channel} ${parsed.data.accountExternalId}).`,
    );
  }
  return outcome;
}
