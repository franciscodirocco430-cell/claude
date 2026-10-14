import { and, asc, desc, eq, ilike, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { DbExecutor } from "@/db/rls";
import { campaigns, leadScores, pipelineStages, prospectHandles, prospects } from "@/db/schema";
import { DomainError } from "@/server/errors";

/** Tope de tarjetas por columna (el resto se cuenta, no se dibuja). */
export const BOARD_COLUMN_LIMIT = 100;

export const boardFiltersSchema = z.object({
  campana: z
    .union([z.uuid(), z.literal("sin")])
    .optional()
    .catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
});
export type BoardFilters = z.infer<typeof boardFiltersSchema>;

export interface BoardLead {
  id: string;
  prospectId: string;
  name: string;
  campaignName: string | null;
  score: number;
  stageId: string;
  updatedAt: string;
}

export interface BoardColumn {
  id: string;
  key: string;
  name: string;
  kind: "open" | "won" | "lost";
  total: number;
  leads: BoardLead[];
}

/**
 * Pipeline tipo kanban: una columna por etapa de la organización y una tarjeta
 * por lead (prospecto × campaña). Los de campañas archivadas no se muestran.
 */
export async function getBoard(
  db: DbExecutor,
  organizationId: string,
  filters: BoardFilters = {},
): Promise<BoardColumn[]> {
  const stages = await db
    .select()
    .from(pipelineStages)
    .where(eq(pipelineStages.organizationId, organizationId))
    .orderBy(asc(pipelineStages.position));

  const where: SQL[] = [
    eq(leadScores.organizationId, organizationId),
    or(isNull(campaigns.id), ne(campaigns.status, "archived"))!,
  ];
  if (filters.campana === "sin") where.push(isNull(leadScores.campaignId));
  else if (filters.campana) where.push(eq(leadScores.campaignId, filters.campana));
  if (filters.q) {
    const like = `%${filters.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push(
      or(
        ilike(prospects.fullName, like),
        ilike(prospects.company, like),
        ilike(prospects.email, like),
        sql`exists (select 1 from ${prospectHandles} where ${prospectHandles.prospectId} = ${prospects.id} and ${prospectHandles.handle} ilike ${like})`,
      )!,
    );
  }

  const ranked = db
    .select({
      id: leadScores.id,
      prospectId: leadScores.prospectId,
      stageId: leadScores.stageId,
      score: leadScores.score,
      updatedAt: leadScores.updatedAt,
      fullName: prospects.fullName,
      company: prospects.company,
      email: prospects.email,
      phone: prospects.phone,
      handle: sql<
        string | null
      >`(select ${prospectHandles.handle} from ${prospectHandles} where ${prospectHandles.prospectId} = ${prospects.id} and ${prospectHandles.handle} is not null limit 1)`.as(
        "handle",
      ),
      campaignName: campaigns.name,
      rn: sql<number>`row_number() over (partition by ${leadScores.stageId} order by ${leadScores.updatedAt} desc, ${leadScores.id})`.as(
        "rn",
      ),
      total: sql<number>`count(*) over (partition by ${leadScores.stageId})::int`.as("total"),
    })
    .from(leadScores)
    .innerJoin(prospects, eq(prospects.id, leadScores.prospectId))
    .leftJoin(
      campaigns,
      and(
        eq(campaigns.id, leadScores.campaignId),
        eq(campaigns.organizationId, leadScores.organizationId),
      ),
    )
    .where(and(...where))
    .as("ranked");
  const rows = await db
    .select()
    .from(ranked)
    .where(sql`${ranked.rn} <= ${BOARD_COLUMN_LIMIT}`)
    .orderBy(desc(ranked.updatedAt));

  return stages.map((s) => {
    const mine = rows.filter((r) => r.stageId === s.id);
    return {
      id: s.id,
      key: s.key,
      name: s.name,
      kind: s.kind,
      total: mine[0]?.total ?? 0,
      leads: mine.map((r) => ({
        id: r.id,
        prospectId: r.prospectId,
        name:
          r.fullName ??
          r.company ??
          (r.handle ? `@${r.handle}` : null) ??
          r.email ??
          r.phone ??
          "Sin nombre",
        campaignName: r.campaignName,
        score: r.score,
        stageId: r.stageId,
        updatedAt: r.updatedAt.toISOString(),
      })),
    };
  });
}

/**
 * Mueve un lead a otra etapa a mano (una persona puede volver atrás; la
 * automatización nunca lo hace). La etapa tiene que ser de la organización.
 */
export async function moveLead(
  db: DbExecutor,
  input: { organizationId: string; leadId: string; stageId: string },
) {
  const [stage] = await db
    .select({ id: pipelineStages.id })
    .from(pipelineStages)
    .where(
      and(
        eq(pipelineStages.organizationId, input.organizationId),
        eq(pipelineStages.id, input.stageId),
      ),
    );
  if (!stage) throw new DomainError("not_found", "La etapa no existe.");
  const [row] = await db
    .update(leadScores)
    .set({ stageId: stage.id })
    .where(
      and(eq(leadScores.organizationId, input.organizationId), eq(leadScores.id, input.leadId)),
    )
    .returning({ id: leadScores.id });
  if (!row) throw new DomainError("not_found", "El lead no existe.");
}
