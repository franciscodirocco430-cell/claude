import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { campaigns, prospects, researchNotes } from "@/db/schema";
import type { Channel } from "@/server/compliance/channels";
import { DomainError } from "@/server/errors";
import { enqueueJob } from "@/server/jobs/queue";
import { DRAFT_JOB, RESEARCH_JOB } from "./pipeline";

/** Tope por clic: controla costo y evita encolar miles de llamadas por error. */
export const PREPARE_BATCH_LIMIT = 100;

const PREPARABLE = ["idle", "error"] as const;
const BUSY = ["queued", "researching", "drafting"] as const;

/**
 * Encola investigación + borradores para los prospectos de una campaña que
 * todavía no se prepararon. La transición de estado es atómica (UPDATE …
 * RETURNING), así un doble clic no encola dos veces.
 * Corre con la conexión del servidor: el llamador ya verificó la membresía.
 */
export async function queueCampaignPreparation(
  db: Database,
  input: { organizationId: string; campaignId: string; prospectIds?: string[] },
) {
  const [campaign] = await db
    .select({ status: campaigns.status })
    .from(campaigns)
    .where(
      and(eq(campaigns.id, input.campaignId), eq(campaigns.organizationId, input.organizationId)),
    );
  if (!campaign) throw new DomainError("not_found", "La campaña no existe.");
  if (campaign.status !== "active") {
    throw new DomainError("not_active", "Activá la campaña para preparar mensajes.");
  }

  const candidates = db
    .select({ id: prospects.id })
    .from(prospects)
    .where(
      and(
        eq(prospects.organizationId, input.organizationId),
        eq(prospects.campaignId, input.campaignId),
        inArray(prospects.aiStatus, input.prospectIds ? [...PREPARABLE, "ready"] : [...PREPARABLE]),
        input.prospectIds ? inArray(prospects.id, input.prospectIds) : undefined,
      ),
    )
    .orderBy(prospects.createdAt)
    .limit(PREPARE_BATCH_LIMIT)
    .for("update", { skipLocked: true });

  const queued = await db
    .update(prospects)
    .set({ aiStatus: "queued", aiError: null, aiPendingDrafts: 0 })
    .where(inArray(prospects.id, candidates))
    .returning({ id: prospects.id });

  for (const p of queued) {
    await enqueueJob(db, {
      type: RESEARCH_JOB,
      organizationId: input.organizationId,
      payload: { organizationId: input.organizationId, prospectId: p.id },
      idempotencyKey: `research:${p.id}:${randomUUID()}`,
    });
  }
  return { queued: queued.length };
}

/** Regenera el borrador de un canal usando la última investigación disponible. */
export async function queueDraftRegeneration(
  db: Database,
  input: { organizationId: string; prospectId: string; channel: Channel },
) {
  const [prospect] = await db
    .update(prospects)
    .set({ aiStatus: "drafting", aiError: null, aiPendingDrafts: 1 })
    .where(
      and(
        eq(prospects.id, input.prospectId),
        eq(prospects.organizationId, input.organizationId),
        sql`${prospects.aiStatus} not in (${sql.join(
          BUSY.map((s) => sql`${s}`),
          sql`, `,
        )})`,
      ),
    )
    .returning({ id: prospects.id });
  if (!prospect) throw new DomainError("busy", "La IA ya está trabajando en este prospecto.");

  const [note] = await db
    .select({ id: researchNotes.id })
    .from(researchNotes)
    .where(
      and(
        eq(researchNotes.prospectId, input.prospectId),
        eq(researchNotes.organizationId, input.organizationId),
      ),
    )
    .orderBy(sql`${researchNotes.createdAt} desc`)
    .limit(1);

  await enqueueJob(db, {
    type: DRAFT_JOB,
    organizationId: input.organizationId,
    payload: {
      organizationId: input.organizationId,
      prospectId: input.prospectId,
      channel: input.channel,
      researchNoteId: note?.id ?? null,
    },
    idempotencyKey: `draft:regen:${input.prospectId}:${input.channel}:${randomUUID()}`,
  });
}

export async function countPreparable(db: Database, organizationId: string, campaignId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(prospects)
    .where(
      and(
        eq(prospects.organizationId, organizationId),
        eq(prospects.campaignId, campaignId),
        inArray(prospects.aiStatus, [...PREPARABLE]),
      ),
    );
  return row?.n ?? 0;
}

export async function countBusy(db: Database, organizationId: string, campaignId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(prospects)
    .where(
      and(
        eq(prospects.organizationId, organizationId),
        eq(prospects.campaignId, campaignId),
        inArray(prospects.aiStatus, [...BUSY]),
      ),
    );
  return row?.n ?? 0;
}
