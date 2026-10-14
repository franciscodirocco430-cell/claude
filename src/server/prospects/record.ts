import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { DbExecutor } from "@/db/rls";
import {
  campaigns,
  conversations,
  emailSequences,
  leadScores,
  meetings,
  messages,
  outreachTasks,
  pipelineStages,
  prospectHandles,
  prospects,
  researchNotes,
  sequenceEnrollments,
} from "@/db/schema";

/** Tope de mensajes del historial (los más recientes). */
export const RECORD_MESSAGE_LIMIT = 500;

/**
 * Ficha completa del prospecto (con RLS del usuario): datos, puntaje y respuestas
 * por campaña, historial de TODAS sus conversaciones, investigación, reuniones,
 * tareas y secuencias.
 */
export async function getProspectRecord(
  db: DbExecutor,
  organizationId: string,
  prospectId: string,
) {
  const [row] = await db
    .select({ prospect: prospects, campaignName: campaigns.name })
    .from(prospects)
    .leftJoin(
      campaigns,
      and(
        eq(campaigns.id, prospects.campaignId),
        eq(campaigns.organizationId, prospects.organizationId),
      ),
    )
    .where(and(eq(prospects.organizationId, organizationId), eq(prospects.id, prospectId)));
  if (!row) return null;

  const [handles, leads, convs, research, meetingRows, tasks, enrollments] = await Promise.all([
    db
      .select()
      .from(prospectHandles)
      .where(eq(prospectHandles.prospectId, prospectId))
      .orderBy(asc(prospectHandles.createdAt)),
    db
      .select({
        id: leadScores.id,
        score: leadScores.score,
        answers: leadScores.answers,
        stage: pipelineStages.name,
        campaignId: leadScores.campaignId,
        campaignName: campaigns.name,
        questions: campaigns.qualificationQuestions,
        criteria: campaigns.qualificationCriteria,
      })
      .from(leadScores)
      .innerJoin(pipelineStages, eq(pipelineStages.id, leadScores.stageId))
      .leftJoin(
        campaigns,
        and(
          eq(campaigns.id, leadScores.campaignId),
          eq(campaigns.organizationId, leadScores.organizationId),
        ),
      )
      .where(
        and(eq(leadScores.organizationId, organizationId), eq(leadScores.prospectId, prospectId)),
      ),
    db
      .select({
        id: conversations.id,
        channel: conversations.channel,
        aiPaused: conversations.aiPaused,
        createdAt: conversations.createdAt,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.organizationId, organizationId),
          eq(conversations.prospectId, prospectId),
        ),
      )
      .orderBy(asc(conversations.createdAt)),
    db
      .select()
      .from(researchNotes)
      .where(eq(researchNotes.prospectId, prospectId))
      .orderBy(desc(researchNotes.createdAt))
      .limit(1),
    db
      .select()
      .from(meetings)
      .where(and(eq(meetings.organizationId, organizationId), eq(meetings.prospectId, prospectId)))
      .orderBy(desc(meetings.startsAt)),
    db
      .select({
        id: outreachTasks.id,
        channel: outreachTasks.channel,
        status: outreachTasks.status,
        sentAt: outreachTasks.sentAt,
        skippedReason: outreachTasks.skippedReason,
        failureReason: outreachTasks.failureReason,
        updatedAt: outreachTasks.updatedAt,
      })
      .from(outreachTasks)
      .where(
        and(
          eq(outreachTasks.organizationId, organizationId),
          eq(outreachTasks.prospectId, prospectId),
        ),
      )
      .orderBy(desc(outreachTasks.updatedAt)),
    db
      .select({
        id: sequenceEnrollments.id,
        sequenceName: emailSequences.name,
        status: sequenceEnrollments.status,
        currentStep: sequenceEnrollments.currentStep,
        stopReason: sequenceEnrollments.stopReason,
        lastSentAt: sequenceEnrollments.lastSentAt,
      })
      .from(sequenceEnrollments)
      .innerJoin(emailSequences, eq(emailSequences.id, sequenceEnrollments.sequenceId))
      .where(
        and(
          eq(sequenceEnrollments.organizationId, organizationId),
          eq(sequenceEnrollments.prospectId, prospectId),
        ),
      ),
  ]);

  const history = convs.length
    ? (
        await db
          .select({
            id: messages.id,
            conversationId: messages.conversationId,
            direction: messages.direction,
            author: messages.author,
            body: messages.body,
            sentAt: messages.sentAt,
          })
          .from(messages)
          .where(
            inArray(
              messages.conversationId,
              convs.map((c) => c.id),
            ),
          )
          .orderBy(desc(messages.sentAt), desc(messages.createdAt))
          .limit(RECORD_MESSAGE_LIMIT)
      ).reverse()
    : [];
  const channelOf = new Map(convs.map((c) => [c.id, c.channel]));

  return {
    prospect: row.prospect,
    campaignName: row.campaignName,
    handles,
    leads: leads.map((l) => ({
      ...l,
      questions: (l.questions ?? []).map((q, i) => ({
        text: q,
        answer: l.answers[`q${i + 1}`]?.answer ?? null,
      })),
      criteria: (l.criteria ?? []).map((c, i) => ({
        label: c.label,
        weight: c.weight,
        met: l.answers[`c${i + 1}`]?.met ?? null,
        evidence: l.answers[`c${i + 1}`]?.answer ?? null,
      })),
    })),
    conversations: convs,
    history: history.map((m) => ({ ...m, channel: channelOf.get(m.conversationId)! })),
    research: research[0] ?? null,
    meetings: meetingRows,
    tasks,
    enrollments,
  };
}

export type ProspectRecord = NonNullable<Awaited<ReturnType<typeof getProspectRecord>>>;
