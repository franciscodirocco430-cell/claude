import { and, eq, inArray, sql } from "drizzle-orm";
import type { DbExecutor } from "@/db/rls";
import { leadScores, pipelineStages } from "@/db/schema";
import type { StageKey } from "./default-stages";

/**
 * Mueve el lead a `to` solo si hoy está en alguna de `from` (o si no tiene
 * etapa todavía). Nunca hace retroceder un lead más avanzado.
 */
export async function advanceLeadStage(
  db: DbExecutor,
  input: {
    organizationId: string;
    prospectId: string;
    campaignId: string | null;
    to: StageKey;
    from: StageKey[];
  },
) {
  const stages = await db
    .select({ id: pipelineStages.id, key: pipelineStages.key })
    .from(pipelineStages)
    .where(
      and(
        eq(pipelineStages.organizationId, input.organizationId),
        inArray(pipelineStages.key, [input.to, ...input.from]),
      ),
    );
  const target = stages.find((s) => s.key === input.to)?.id;
  if (!target) return;
  const fromIds = stages.filter((s) => input.from.includes(s.key as StageKey)).map((s) => s.id);
  await db
    .insert(leadScores)
    .values({
      organizationId: input.organizationId,
      prospectId: input.prospectId,
      campaignId: input.campaignId,
      stageId: target,
    })
    .onConflictDoUpdate({
      target: [leadScores.organizationId, leadScores.prospectId, leadScores.campaignId],
      set: { stageId: target },
      setWhere: fromIds.length ? inArray(leadScores.stageId, fromIds) : sql`false`,
    });
}
