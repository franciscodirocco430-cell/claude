import { and, asc, count, desc, eq, inArray, isNotNull, notExists, sql } from "drizzle-orm";
import type { DbExecutor } from "@/db/rls";
import {
  campaigns,
  connectedAccounts,
  emailSequences,
  outreachTasks,
  prospects,
  sequenceEnrollments,
  sequenceSteps,
  suppressionList,
} from "@/db/schema";
import { isAdminRole, type Role } from "@/server/auth/permissions";
import { SIGNATURE_PLACEHOLDER } from "@/server/email/compose";
import {
  firstName,
  renderTemplate,
  templateVariables,
  type TemplateValues,
} from "@/server/email/template";
import { DomainError } from "@/server/errors";
import type { SequenceInput } from "./schemas";

function assertAdmin(role: Role) {
  if (!isAdminRole(role))
    throw new DomainError("forbidden", "Solo owners y admins pueden gestionar secuencias.");
}

async function assertMailbox(db: DbExecutor, organizationId: string, mailboxId: string | null) {
  if (!mailboxId) return;
  const [row] = await db
    .select({ id: connectedAccounts.id })
    .from(connectedAccounts)
    .where(
      and(
        eq(connectedAccounts.id, mailboxId),
        eq(connectedAccounts.organizationId, organizationId),
        eq(connectedAccounts.channel, "email"),
      ),
    );
  if (!row) throw new DomainError("not_found", "La casilla elegida no existe.");
}

async function writeSteps(
  db: DbExecutor,
  organizationId: string,
  sequenceId: string,
  steps: SequenceInput["steps"],
) {
  await db
    .delete(sequenceSteps)
    .where(
      and(
        eq(sequenceSteps.sequenceId, sequenceId),
        eq(sequenceSteps.organizationId, organizationId),
      ),
    );
  await db.insert(sequenceSteps).values(
    steps.map((s, i) => ({
      organizationId,
      sequenceId,
      position: i,
      delayHours: s.delayDays * 24,
      subject: s.subject,
      body: s.body,
    })),
  );
}

export async function createSequence(
  db: DbExecutor,
  input: { organizationId: string; campaignId: string; actorRole: Role; data: SequenceInput },
) {
  assertAdmin(input.actorRole);
  await assertMailbox(db, input.organizationId, input.data.mailboxAccountId);
  const [seq] = await db
    .insert(emailSequences)
    .values({
      organizationId: input.organizationId,
      campaignId: input.campaignId,
      name: input.data.name,
      mailboxAccountId: input.data.mailboxAccountId,
      sendStartHour: input.data.sendStartHour,
      sendEndHour: input.data.sendEndHour,
      sendDays: input.data.sendDays,
    })
    .returning({ id: emailSequences.id });
  await writeSteps(db, input.organizationId, seq!.id, input.data.steps);
  return seq!.id;
}

export async function updateSequence(
  db: DbExecutor,
  input: { organizationId: string; sequenceId: string; actorRole: Role; data: SequenceInput },
) {
  assertAdmin(input.actorRole);
  await assertMailbox(db, input.organizationId, input.data.mailboxAccountId);
  const [row] = await db
    .update(emailSequences)
    .set({
      name: input.data.name,
      mailboxAccountId: input.data.mailboxAccountId,
      sendStartHour: input.data.sendStartHour,
      sendEndHour: input.data.sendEndHour,
      sendDays: input.data.sendDays,
    })
    .where(
      and(
        eq(emailSequences.id, input.sequenceId),
        eq(emailSequences.organizationId, input.organizationId),
      ),
    )
    .returning({ id: emailSequences.id });
  if (!row) throw new DomainError("not_found", "La secuencia no existe.");
  await writeSteps(db, input.organizationId, input.sequenceId, input.data.steps);
}

export async function getSequence(db: DbExecutor, organizationId: string, sequenceId: string) {
  const [seq] = await db
    .select()
    .from(emailSequences)
    .where(
      and(eq(emailSequences.id, sequenceId), eq(emailSequences.organizationId, organizationId)),
    );
  if (!seq) return null;
  const steps = await db
    .select()
    .from(sequenceSteps)
    .where(eq(sequenceSteps.sequenceId, seq.id))
    .orderBy(asc(sequenceSteps.position));
  return { ...seq, steps };
}

export type EnrollmentStats = Record<(typeof sequenceEnrollments.$inferSelect)["status"], number>;

export async function listSequences(db: DbExecutor, organizationId: string, campaignId: string) {
  const seqs = await db
    .select({
      id: emailSequences.id,
      name: emailSequences.name,
      status: emailSequences.status,
      mailbox: connectedAccounts.displayName,
    })
    .from(emailSequences)
    .leftJoin(connectedAccounts, eq(connectedAccounts.id, emailSequences.mailboxAccountId))
    .where(
      and(
        eq(emailSequences.organizationId, organizationId),
        eq(emailSequences.campaignId, campaignId),
      ),
    )
    .orderBy(desc(emailSequences.createdAt));
  const stats = await enrollmentStats(
    db,
    organizationId,
    seqs.map((s) => s.id),
  );
  return seqs.map((s) => ({ ...s, stats: stats.get(s.id) ?? emptyStats() }));
}

function emptyStats(): EnrollmentStats {
  return {
    active: 0,
    completed: 0,
    stopped_replied: 0,
    stopped_bounced: 0,
    stopped_unsubscribed: 0,
    stopped_manual: 0,
  };
}

export async function enrollmentStats(
  db: DbExecutor,
  organizationId: string,
  sequenceIds: string[],
) {
  const map = new Map<string, EnrollmentStats>();
  if (!sequenceIds.length) return map;
  const rows = await db
    .select({
      sequenceId: sequenceEnrollments.sequenceId,
      status: sequenceEnrollments.status,
      n: count(),
    })
    .from(sequenceEnrollments)
    .where(
      and(
        eq(sequenceEnrollments.organizationId, organizationId),
        inArray(sequenceEnrollments.sequenceId, sequenceIds),
      ),
    )
    .groupBy(sequenceEnrollments.sequenceId, sequenceEnrollments.status);
  for (const r of rows) {
    const s = map.get(r.sequenceId) ?? emptyStats();
    s[r.status] = r.n;
    map.set(r.sequenceId, s);
  }
  return map;
}

export async function changeSequenceStatus(
  db: DbExecutor,
  input: {
    organizationId: string;
    sequenceId: string;
    actorRole: Role;
    action: "activate" | "pause";
  },
) {
  assertAdmin(input.actorRole);
  const seq = await getSequence(db, input.organizationId, input.sequenceId);
  if (!seq) throw new DomainError("not_found", "La secuencia no existe.");
  if (input.action === "activate") {
    if (!seq.mailboxAccountId)
      throw new DomainError("no_mailbox", "Elegí una casilla de Gmail antes de activar.");
    const [mailbox] = await db
      .select({ status: connectedAccounts.status })
      .from(connectedAccounts)
      .where(eq(connectedAccounts.id, seq.mailboxAccountId));
    if (mailbox?.status !== "active") {
      throw new DomainError(
        "mailbox_inactive",
        "La casilla no está conectada. Reconectala en Configuración.",
      );
    }
    if (!seq.steps.length) throw new DomainError("no_steps", "La secuencia no tiene pasos.");
  }
  await db
    .update(emailSequences)
    .set({ status: input.action === "activate" ? "active" : "paused" })
    .where(
      and(eq(emailSequences.id, seq.id), eq(emailSequences.organizationId, input.organizationId)),
    );
}

/** Quita el pie (firma + baja) que `composeEmailBody` agregó al borrador de la IA. */
export function stripComposedFooter(body: string | null): string | null {
  if (!body) return null;
  const idx = body.indexOf(SIGNATURE_PLACEHOLDER);
  return (idx >= 0 ? body.slice(0, idx) : body).trim() || null;
}

export function templateValues(
  prospect: {
    fullName: string | null;
    company: string | null;
    industry: string | null;
    website: string | null;
  },
  aiDraft: { subject: string | null; body: string | null } | null,
): TemplateValues {
  return {
    nombre: firstName(prospect.fullName),
    nombre_completo: prospect.fullName,
    empresa: prospect.company,
    rubro: prospect.industry,
    web: prospect.website,
    asunto_ia: aiDraft?.subject ?? null,
    mensaje_ia: stripComposedFooter(aiDraft?.body ?? null),
  };
}

export async function latestEmailDraft(db: DbExecutor, organizationId: string, prospectId: string) {
  const [task] = await db
    .select({ subject: outreachTasks.draftSubject, body: outreachTasks.draftMessage })
    .from(outreachTasks)
    .where(
      and(
        eq(outreachTasks.organizationId, organizationId),
        eq(outreachTasks.prospectId, prospectId),
        eq(outreachTasks.channel, "email"),
        inArray(outreachTasks.status, ["ready", "pending"]),
        isNotNull(outreachTasks.draftMessage),
      ),
    )
    .orderBy(desc(outreachTasks.updatedAt))
    .limit(1);
  return task ?? null;
}

/** Vista previa de un paso con los datos reales de un prospecto. */
export async function previewStep(
  db: DbExecutor,
  input: {
    organizationId: string;
    campaignId: string;
    prospectId: string;
    subject: string;
    body: string;
    firstSubject: string;
  },
) {
  const [prospect] = await db
    .select()
    .from(prospects)
    .where(
      and(
        eq(prospects.id, input.prospectId),
        eq(prospects.organizationId, input.organizationId),
        eq(prospects.campaignId, input.campaignId),
      ),
    );
  if (!prospect) throw new DomainError("not_found", "El prospecto no existe.");
  const values = templateValues(
    prospect,
    await latestEmailDraft(db, input.organizationId, prospect.id),
  );
  const subjectTemplate = input.subject.trim() || `Re: ${input.firstSubject}`;
  const subject = renderTemplate(subjectTemplate, values);
  const body = renderTemplate(input.body, values);
  return {
    to: prospect.email,
    subject: subject.ok ? subject.text : null,
    body: body.ok ? body.text : null,
    missing: [...(subject.ok ? [] : subject.missing), ...(body.ok ? [] : body.missing)],
  };
}

export const ENROLL_BATCH_LIMIT = 500;

/**
 * Inscribe prospectos elegibles: con email, sin supresión, no inscriptos en esta
 * secuencia ni activos en otra (nadie recibe dos secuencias a la vez). Si el
 * primer paso usa las variables de IA, solo entran los que tienen borrador listo.
 */
export async function enrollEligible(
  db: DbExecutor,
  input: { organizationId: string; sequenceId: string; actorRole: Role; now?: Date },
) {
  assertAdmin(input.actorRole);
  const seq = await getSequence(db, input.organizationId, input.sequenceId);
  if (!seq || !seq.campaignId) throw new DomainError("not_found", "La secuencia no existe.");
  const [campaign] = await db
    .select({ status: campaigns.status })
    .from(campaigns)
    .where(eq(campaigns.id, seq.campaignId));
  if (campaign?.status !== "active")
    throw new DomainError("not_active", "La campaña tiene que estar activa.");
  const first = seq.steps[0];
  if (!first) throw new DomainError("no_steps", "La secuencia no tiene pasos.");
  const needsAi = [...templateVariables(first.subject), ...templateVariables(first.body)].some(
    (v) => ["mensaje_ia", "asunto_ia"].includes(v),
  );

  const conditions = [
    eq(prospects.organizationId, input.organizationId),
    eq(prospects.campaignId, seq.campaignId),
    isNotNull(prospects.email),
    notExists(
      db
        .select({ one: sql`1` })
        .from(suppressionList)
        .where(
          and(
            eq(suppressionList.organizationId, input.organizationId),
            eq(suppressionList.kind, "email"),
            eq(suppressionList.value, prospects.email),
          ),
        ),
    ),
    notExists(
      db
        .select({ one: sql`1` })
        .from(sequenceEnrollments)
        .where(
          and(
            eq(sequenceEnrollments.prospectId, prospects.id),
            sql`(${sequenceEnrollments.sequenceId} = ${seq.id} or ${sequenceEnrollments.status} = 'active')`,
          ),
        ),
    ),
  ];
  if (needsAi) {
    conditions.push(
      sql`exists (select 1 from outreach_tasks t where t.prospect_id = ${prospects.id} and t.channel = 'email'
          and t.status in ('ready', 'pending') and t.draft_message is not null and t.draft_subject is not null)`,
    );
  }
  const eligible = await db
    .select({ id: prospects.id })
    .from(prospects)
    .where(and(...conditions))
    .orderBy(asc(prospects.createdAt))
    .limit(ENROLL_BATCH_LIMIT);
  if (!eligible.length) return { enrolled: 0, needsAi };
  const inserted = await db
    .insert(sequenceEnrollments)
    .values(
      eligible.map((p) => ({
        organizationId: input.organizationId,
        sequenceId: seq.id,
        prospectId: p.id,
        status: "active" as const,
        currentStep: 0,
        nextSendAt: input.now ?? new Date(),
      })),
    )
    .onConflictDoNothing()
    .returning({ id: sequenceEnrollments.id });
  return { enrolled: inserted.length, needsAi };
}
