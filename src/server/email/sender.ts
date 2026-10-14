import { randomInt } from "node:crypto";
import { and, asc, eq, gte, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  campaigns,
  connectedAccounts,
  conversations,
  emailSequences,
  messages,
  organizations,
  prospects,
  sequenceEnrollments,
  sequenceSteps,
  suppressionList,
} from "@/db/schema";
import { getWindowStatus } from "@/server/compliance/messaging-window";
import { decideOutbound } from "@/server/compliance/outbound-policy";
import { enqueueJob, PermanentJobError, type Job } from "@/server/jobs/queue";
import { advanceLeadStage } from "@/server/pipeline/stages";
import { startOfDayInZone } from "@/server/queue/open-link";
import { latestEmailDraft, templateValues } from "@/server/sequences/service";
import { composeEmailBody, finalizeEmailBody } from "./compose";
import { buildMimeMessage } from "./mime";
import {
  extractReplyText,
  MailProviderError,
  type MailboxRef,
  type MailProvider,
} from "./provider";
import { isValidTimeZone, nextSendSlot } from "./schedule";
import { renderTemplate } from "./template";
import { signUnsubscribeToken } from "./unsubscribe";

export const SEND_JOB = "send_sequence_step";
export const SYNC_JOB = "sync_mailbox";

export interface EmailDeps {
  db: Database;
  mail: MailProvider;
  appUrl: string;
  unsubscribeSecret: string;
  defaultTimeZone: string;
  minGapSeconds: number;
  maxGapSeconds: number;
  now?: () => Date;
  random?: (min: number, max: number) => number;
}

const nowOf = (d: EmailDeps) => (d.now ? d.now() : new Date());
const rand = (d: EmailDeps, min: number, max: number) =>
  d.random ? d.random(min, max) : max > min ? randomInt(min, max + 1) : min;

// ───────────────────────────── Despacho ─────────────────────────────

/** Encola envíos vencidos y lecturas de hilos. Idempotente: se puede correr seguido y en varios workers. */
export async function dispatchEmailWork(db: Database, now = new Date(), syncIntervalMs = 300_000) {
  const due = await db
    .select({
      id: sequenceEnrollments.id,
      organizationId: sequenceEnrollments.organizationId,
      step: sequenceEnrollments.currentStep,
      nextSendAt: sequenceEnrollments.nextSendAt,
    })
    .from(sequenceEnrollments)
    .innerJoin(emailSequences, eq(emailSequences.id, sequenceEnrollments.sequenceId))
    .where(
      and(
        eq(sequenceEnrollments.status, "active"),
        eq(emailSequences.status, "active"),
        lte(sequenceEnrollments.nextSendAt, now),
      ),
    )
    .orderBy(asc(sequenceEnrollments.nextSendAt))
    .limit(500);
  for (const e of due) {
    await enqueueJob(db, {
      type: SEND_JOB,
      organizationId: e.organizationId,
      payload: { organizationId: e.organizationId, enrollmentId: e.id, step: e.step },
      // La clave incluye nextSendAt: si se reprograma, el próximo intento es otro job.
      idempotencyKey: `send:${e.id}:${e.step}:${e.nextSendAt?.toISOString()}`,
    });
  }

  // Lectura de hilos: una por casilla por intervalo (5 minutos por defecto).
  const bucket = Math.floor(now.getTime() / syncIntervalMs);
  const mailboxes = await db
    .selectDistinct({ id: connectedAccounts.id, organizationId: connectedAccounts.organizationId })
    .from(connectedAccounts)
    .innerJoin(emailSequences, eq(emailSequences.mailboxAccountId, connectedAccounts.id))
    .innerJoin(sequenceEnrollments, eq(sequenceEnrollments.sequenceId, emailSequences.id))
    .where(
      and(
        eq(connectedAccounts.status, "active"),
        isNotNull(sequenceEnrollments.gmailThreadId),
        or(
          eq(sequenceEnrollments.status, "active"),
          and(
            eq(sequenceEnrollments.status, "completed"),
            gte(sequenceEnrollments.lastSentAt, new Date(now.getTime() - 30 * 86_400_000)),
          ),
        ),
      ),
    );
  for (const m of mailboxes) {
    await enqueueJob(db, {
      type: SYNC_JOB,
      organizationId: m.organizationId,
      payload: { organizationId: m.organizationId, accountId: m.id },
      idempotencyKey: `sync:${m.id}:${bucket}`,
    });
  }
  return { sends: due.length, syncs: mailboxes.length };
}

// ───────────────────────────── Envío ─────────────────────────────

async function loadEnrollment(db: Database, organizationId: string, enrollmentId: string) {
  const [row] = await db
    .select({
      enrollment: sequenceEnrollments,
      sequence: emailSequences,
      prospect: prospects,
      campaignStatus: campaigns.status,
      mailbox: connectedAccounts,
      orgTimeZone: organizations.timezone,
    })
    .from(sequenceEnrollments)
    .innerJoin(emailSequences, eq(emailSequences.id, sequenceEnrollments.sequenceId))
    .innerJoin(prospects, eq(prospects.id, sequenceEnrollments.prospectId))
    .innerJoin(organizations, eq(organizations.id, sequenceEnrollments.organizationId))
    .leftJoin(campaigns, eq(campaigns.id, emailSequences.campaignId))
    .leftJoin(connectedAccounts, eq(connectedAccounts.id, emailSequences.mailboxAccountId))
    .where(
      and(
        eq(sequenceEnrollments.id, enrollmentId),
        eq(sequenceEnrollments.organizationId, organizationId),
      ),
    );
  return row ?? null;
}

async function stopEnrollment(
  db: Database,
  id: string,
  status: "stopped_replied" | "stopped_bounced" | "stopped_unsubscribed" | "stopped_manual",
  reason: string,
) {
  await db
    .update(sequenceEnrollments)
    .set({ status, stopReason: reason, stoppedAt: new Date(), nextSendAt: null })
    .where(and(eq(sequenceEnrollments.id, id), eq(sequenceEnrollments.status, "active")));
}

async function reschedule(db: Database, id: string, at: Date) {
  await db
    .update(sequenceEnrollments)
    .set({ nextSendAt: at })
    .where(eq(sequenceEnrollments.id, id));
}

async function isEmailSuppressed(db: Database, organizationId: string, email: string) {
  const [row] = await db
    .select({ id: suppressionList.id })
    .from(suppressionList)
    .where(
      and(
        eq(suppressionList.organizationId, organizationId),
        eq(suppressionList.kind, "email"),
        eq(suppressionList.value, email.toLowerCase()),
      ),
    )
    .limit(1);
  return !!row;
}

export async function runSendJob(deps: EmailDeps, job: Job) {
  const payload = job.payload as { organizationId?: string; enrollmentId?: string; step?: number };
  if (
    !payload.organizationId ||
    !payload.enrollmentId ||
    payload.organizationId !== job.organizationId
  ) {
    throw new PermanentJobError("Payload inválido.");
  }
  const { db } = deps;
  const now = nowOf(deps);
  const row = await loadEnrollment(db, payload.organizationId, payload.enrollmentId);
  if (!row) return;
  const { enrollment, sequence, prospect, mailbox } = row;
  // Idempotencia: si ya avanzó o se frenó, este job no hace nada.
  if (enrollment.status !== "active" || enrollment.currentStep !== payload.step) return;
  if (sequence.status !== "active" || row.campaignStatus !== "active") {
    await reschedule(db, enrollment.id, new Date(now.getTime() + 3600_000));
    return;
  }
  if (!mailbox || mailbox.status !== "active") {
    await reschedule(db, enrollment.id, new Date(now.getTime() + 3600_000));
    return;
  }
  const to = prospect.email;
  if (!to) {
    await stopEnrollment(db, enrollment.id, "stopped_manual", "El prospecto no tiene email.");
    return;
  }

  // Única puerta de envíos automáticos: lista de supresión incluida.
  const decision = decideOutbound({
    channel: "email",
    window: getWindowStatus({
      channel: "email",
      lastInboundAt: null,
      businessMessagesSinceInbound: 0,
      now,
    }),
    suppressed: await isEmailSuppressed(db, enrollment.organizationId, to),
    whatsappOptIn: false,
  });
  if (decision.action !== "auto_send") {
    await stopEnrollment(
      db,
      enrollment.id,
      "stopped_unsubscribed",
      "Está en la lista de supresión.",
    );
    return;
  }

  const mailboxRef: MailboxRef = {
    id: mailbox.id,
    organizationId: mailbox.organizationId,
    email: mailbox.externalId,
  };

  // Antes de un seguimiento, leer el hilo: si respondió o rebotó, no se envía.
  if (enrollment.gmailThreadId) {
    await syncThread(deps, { mailbox: mailboxRef, enrollmentId: enrollment.id });
    const [fresh] = await db
      .select({ status: sequenceEnrollments.status })
      .from(sequenceEnrollments)
      .where(eq(sequenceEnrollments.id, enrollment.id));
    if (fresh?.status !== "active") return;
  }

  // Horario hábil del prospecto.
  const tz = isValidTimeZone(prospect.timezone)
    ? prospect.timezone
    : (row.orgTimeZone ?? deps.defaultTimeZone);
  const hours = {
    startHour: sequence.sendStartHour,
    endHour: sequence.sendEndHour,
    days: sequence.sendDays,
  };
  const slot = nextSendSlot(now, tz, hours, rand(deps, 0, 45));
  if (slot.getTime() - now.getTime() > 60_000) {
    await reschedule(db, enrollment.id, slot);
    return;
  }

  const steps = await db
    .select()
    .from(sequenceSteps)
    .where(eq(sequenceSteps.sequenceId, sequence.id))
    .orderBy(asc(sequenceSteps.position));
  const step = steps[enrollment.currentStep];
  if (!step) {
    await db
      .update(sequenceEnrollments)
      .set({ status: "completed", nextSendAt: null })
      .where(eq(sequenceEnrollments.id, enrollment.id));
    return;
  }

  // Render antes de reservar cupo: si falta un dato, se frena sin gastar el cupo.
  const values = templateValues(
    prospect,
    await latestEmailDraft(db, enrollment.organizationId, prospect.id),
  );
  const subjectTpl = step.subject.trim() || `Re: ${enrollment.firstSubject ?? ""}`;
  const subject = renderTemplate(subjectTpl, values);
  const body = renderTemplate(step.body, values);
  if (!subject.ok || !body.ok) {
    const missing = [...(subject.ok ? [] : subject.missing), ...(body.ok ? [] : body.missing)];
    await stopEnrollment(
      db,
      enrollment.id,
      "stopped_manual",
      `Faltan datos para la plantilla: ${missing.join(", ")}.`,
    );
    return;
  }

  // Cupo diario y espaciado de la casilla, con la fila bloqueada (un envío por vez por casilla).
  const orgDayStart = startOfDayInZone(now, row.orgTimeZone ?? deps.defaultTimeZone);
  const reserved = await db.transaction(async (tx) => {
    const [acct] = await tx
      .select({ lastSentAt: connectedAccounts.lastSentAt, limit: connectedAccounts.dailySendLimit })
      .from(connectedAccounts)
      .where(eq(connectedAccounts.id, mailbox.id))
      .for("update");
    const [sentToday] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(messages)
      .innerJoin(conversations, eq(conversations.id, messages.conversationId))
      .where(
        and(
          eq(conversations.connectedAccountId, mailbox.id),
          eq(messages.direction, "out"),
          gte(messages.sentAt, orgDayStart),
        ),
      );
    if ((sentToday?.n ?? 0) >= (acct?.limit ?? 0)) {
      const tomorrow = nextSendSlot(
        new Date(orgDayStart.getTime() + 86_400_000),
        tz,
        hours,
        rand(deps, 0, 120),
      );
      return { ok: false as const, at: tomorrow };
    }
    const gap = rand(deps, deps.minGapSeconds, deps.maxGapSeconds) * 1000;
    const earliest = acct?.lastSentAt ? new Date(acct.lastSentAt.getTime() + gap) : now;
    if (earliest.getTime() > now.getTime()) return { ok: false as const, at: earliest };
    await tx
      .update(connectedAccounts)
      .set({ lastSentAt: now })
      .where(eq(connectedAccounts.id, mailbox.id));
    return { ok: true as const };
  });
  if (!reserved.ok) {
    await reschedule(db, enrollment.id, reserved.at);
    return;
  }

  const token = signUnsubscribeToken(
    { o: enrollment.organizationId, e: to, n: enrollment.id },
    deps.unsubscribeSecret,
  );
  // En el cuerpo, la página de confirmación; en el encabezado, el endpoint de baja en un clic (POST).
  const unsubscribeUrl = `${deps.appUrl}/baja/${token}`;
  const oneClickUrl = `${deps.appUrl}/api/baja/${token}`;
  const text = finalizeEmailBody(composeEmailBody(body.text), mailbox.signature, unsubscribeUrl);
  const raw = buildMimeMessage({
    from: { email: mailbox.externalId, name: mailbox.signature?.split("\n")[0] ?? null },
    to,
    subject: subject.text,
    text,
    inReplyTo: enrollment.firstMessageRfcId,
    references: enrollment.firstMessageRfcId,
    listUnsubscribeUrl: oneClickUrl,
  });

  let sent;
  try {
    sent = await deps.mail.send(mailboxRef, { raw, threadId: enrollment.gmailThreadId });
  } catch (error) {
    if (error instanceof MailProviderError) {
      if (error.kind === "invalid_recipient") {
        await stopEnrollment(db, enrollment.id, "stopped_bounced", error.message);
        return;
      }
      if (error.kind === "auth") {
        await db
          .update(connectedAccounts)
          .set({ status: "error", lastError: error.message })
          .where(eq(connectedAccounts.id, mailbox.id));
        await reschedule(db, enrollment.id, new Date(now.getTime() + 3600_000));
        return;
      }
    }
    throw error; // transitorio: reintenta el job con backoff
  }

  await db.transaction(async (tx) => {
    let [conv] = await tx
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.organizationId, enrollment.organizationId),
          eq(conversations.channel, "email"),
          eq(conversations.externalThreadId, sent.threadId),
        ),
      );
    if (!conv) {
      [conv] = await tx
        .insert(conversations)
        .values({
          organizationId: enrollment.organizationId,
          prospectId: prospect.id,
          campaignId: sequence.campaignId,
          channel: "email",
          connectedAccountId: mailbox.id,
          externalThreadId: sent.threadId,
        })
        .returning({ id: conversations.id });
    }
    await tx
      .update(conversations)
      .set({ lastOutboundAt: now })
      .where(eq(conversations.id, conv!.id));
    await tx
      .insert(messages)
      .values({
        organizationId: enrollment.organizationId,
        conversationId: conv!.id,
        direction: "out",
        // Si el cuerpo vino del borrador de la IA, el autor es la IA.
        author: /\{\{\s*mensaje_ia/.test(step.body) ? "ai" : "human",
        body: `${subject.text}\n\n${text}`,
        externalId: sent.messageId,
        sentAt: now,
      })
      .onConflictDoNothing();
    const next = steps[enrollment.currentStep + 1];
    await tx
      .update(sequenceEnrollments)
      .set({
        currentStep: enrollment.currentStep + 1,
        lastSentAt: now,
        gmailThreadId: sent.threadId,
        firstMessageRfcId: enrollment.firstMessageRfcId ?? sent.rfcMessageId,
        firstSubject: enrollment.firstSubject ?? subject.text,
        status: next ? "active" : "completed",
        nextSendAt: next ? new Date(now.getTime() + next.delayHours * 3600_000) : null,
      })
      .where(eq(sequenceEnrollments.id, enrollment.id));
    await advanceLeadStage(tx, {
      organizationId: enrollment.organizationId,
      prospectId: prospect.id,
      campaignId: sequence.campaignId,
      to: "contactado",
      from: ["nuevo"],
    });
  });
}

// ───────────────────────────── Respuestas y rebotes ─────────────────────────────

const addressOf = (from: string) => (/<([^>]+)>/.exec(from)?.[1] ?? from).trim().toLowerCase();

/** Lee el hilo de una inscripción: guarda respuestas, frena ante respuesta o rebote. */
export async function syncThread(
  deps: EmailDeps,
  input: { mailbox: MailboxRef; enrollmentId: string },
) {
  const { db } = deps;
  const [row] = await db
    .select({ enrollment: sequenceEnrollments, sequence: emailSequences, prospect: prospects })
    .from(sequenceEnrollments)
    .innerJoin(emailSequences, eq(emailSequences.id, sequenceEnrollments.sequenceId))
    .innerJoin(prospects, eq(prospects.id, sequenceEnrollments.prospectId))
    .where(eq(sequenceEnrollments.id, input.enrollmentId));
  const threadId = row?.enrollment.gmailThreadId;
  if (!row || !threadId) return;
  const { enrollment, sequence, prospect } = row;

  const thread = await deps.mail.getThread(input.mailbox, threadId);
  const [conv] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.organizationId, enrollment.organizationId),
        eq(conversations.prospectId, prospect.id),
        eq(conversations.channel, "email"),
        eq(conversations.externalThreadId, threadId),
      ),
    );
  if (!conv) return;
  const known = new Set(
    (
      await db
        .select({ externalId: messages.externalId })
        .from(messages)
        .where(eq(messages.conversationId, conv.id))
    ).map((m) => m.externalId),
  );

  for (const msg of thread) {
    if (known.has(msg.id) || addressOf(msg.from) === input.mailbox.email.toLowerCase()) continue;

    if (msg.isBounce) {
      await db.transaction(async (tx) => {
        await tx
          .insert(suppressionList)
          .values({
            organizationId: enrollment.organizationId,
            kind: "email",
            value: prospect.email!.toLowerCase(),
            channel: "email",
            reason: "bounced",
          })
          .onConflictDoNothing();
        await tx
          .update(sequenceEnrollments)
          .set({
            status: "stopped_bounced",
            stopReason: "El email rebotó.",
            stoppedAt: new Date(),
            nextSendAt: null,
          })
          .where(
            and(
              eq(sequenceEnrollments.id, enrollment.id),
              inArray(sequenceEnrollments.status, ["active", "completed"]),
            ),
          );
        await tx
          .insert(messages)
          .values({
            organizationId: enrollment.organizationId,
            conversationId: conv.id,
            direction: "in",
            author: "prospect",
            body: "[Rebote] El email no pudo entregarse.",
            externalId: msg.id,
            sentAt: msg.date,
          })
          .onConflictDoNothing();
      });
      continue;
    }

    const text = extractReplyText(msg.text) || msg.text.trim() || "(sin texto)";
    await db.transaction(async (tx) => {
      await tx
        .insert(messages)
        .values({
          organizationId: enrollment.organizationId,
          conversationId: conv.id,
          direction: "in",
          author: "prospect",
          body: msg.autoSubmitted ? `[Respuesta automática] ${text}` : text,
          externalId: msg.id,
          sentAt: msg.date,
        })
        .onConflictDoNothing();
      // Las respuestas automáticas (fuera de oficina) no frenan la secuencia.
      if (msg.autoSubmitted) return;
      await tx
        .update(conversations)
        .set({ lastInboundAt: msg.date, businessMessagesSinceInbound: 0 })
        .where(eq(conversations.id, conv.id));
      // Respondió: se frenan TODAS sus secuencias activas.
      await tx
        .update(sequenceEnrollments)
        .set({
          status: "stopped_replied",
          stopReason: "Respondió.",
          stoppedAt: new Date(),
          nextSendAt: null,
        })
        .where(
          and(
            eq(sequenceEnrollments.prospectId, prospect.id),
            inArray(sequenceEnrollments.status, ["active", "completed"]),
          ),
        );
      await advanceLeadStage(tx, {
        organizationId: enrollment.organizationId,
        prospectId: prospect.id,
        campaignId: sequence.campaignId,
        to: "respondio",
        from: ["nuevo", "contactado"],
      });
    });
  }
}

export async function runSyncJob(deps: EmailDeps, job: Job) {
  const payload = job.payload as { organizationId?: string; accountId?: string };
  if (
    !payload.organizationId ||
    !payload.accountId ||
    payload.organizationId !== job.organizationId
  ) {
    throw new PermanentJobError("Payload inválido.");
  }
  const { db } = deps;
  const [mailbox] = await db
    .select()
    .from(connectedAccounts)
    .where(
      and(
        eq(connectedAccounts.id, payload.accountId),
        eq(connectedAccounts.organizationId, payload.organizationId),
      ),
    );
  if (!mailbox || mailbox.status !== "active") return;
  const ref: MailboxRef = {
    id: mailbox.id,
    organizationId: mailbox.organizationId,
    email: mailbox.externalId,
  };
  const since = new Date(nowOf(deps).getTime() - 30 * 86_400_000);
  const enrollments = await db
    .select({ id: sequenceEnrollments.id })
    .from(sequenceEnrollments)
    .innerJoin(emailSequences, eq(emailSequences.id, sequenceEnrollments.sequenceId))
    .where(
      and(
        eq(emailSequences.mailboxAccountId, mailbox.id),
        isNotNull(sequenceEnrollments.gmailThreadId),
        or(
          eq(sequenceEnrollments.status, "active"),
          and(
            eq(sequenceEnrollments.status, "completed"),
            gte(sequenceEnrollments.lastSentAt, since),
          ),
        ),
      ),
    )
    .limit(200);
  for (const e of enrollments) {
    try {
      await syncThread(deps, { mailbox: ref, enrollmentId: e.id });
    } catch (error) {
      if (error instanceof MailProviderError && error.kind === "auth") {
        await db
          .update(connectedAccounts)
          .set({ status: "error", lastError: error.message })
          .where(eq(connectedAccounts.id, mailbox.id));
        return;
      }
      throw error;
    }
  }
}

// ───────────────────────────── Baja ─────────────────────────────

/** Baja por link: suprime el email en la organización y frena sus secuencias. Idempotente. */
export async function unsubscribeEmail(
  db: Database,
  input: { organizationId: string; email: string },
) {
  const email = input.email.trim().toLowerCase();
  await db.transaction(async (tx) => {
    await tx
      .insert(suppressionList)
      .values({
        organizationId: input.organizationId,
        kind: "email",
        value: email,
        channel: "email",
        reason: "unsubscribed",
      })
      .onConflictDoNothing();
    const owned = tx
      .select({ id: prospects.id })
      .from(prospects)
      .where(and(eq(prospects.organizationId, input.organizationId), eq(prospects.email, email)));
    await tx
      .update(sequenceEnrollments)
      .set({
        status: "stopped_unsubscribed",
        stopReason: "Se dio de baja.",
        stoppedAt: new Date(),
        nextSendAt: null,
      })
      .where(
        and(
          eq(sequenceEnrollments.organizationId, input.organizationId),
          eq(sequenceEnrollments.status, "active"),
          inArray(sequenceEnrollments.prospectId, owned),
        ),
      );
  });
}
