import type { DbExecutor } from "@/db/rls";
import { ingestProspects } from "../ingest";
import type { ProspectSource, SourceQuery } from "./types";

/**
 * Busca en una fuente pública y carga los resultados por el mismo pipeline que
 * el CSV (normalización, deduplicación, supresión). La fuente ya tiene que
 * venir validada con `getAvailableSource`.
 */
export async function importFromSource(
  db: DbExecutor,
  input: {
    source: ProspectSource;
    query: SourceQuery;
    organizationId: string;
    campaignId: string;
    ownerId?: string | null;
  },
) {
  const results = await input.source.search(input.query);
  return ingestProspects(db, {
    organizationId: input.organizationId,
    campaignId: input.campaignId,
    source: "public_business_data",
    sourceRef: input.source.id,
    ownerId: input.ownerId,
    rows: results.map((r, i) => ({ row: i + 1, raw: r.prospect })),
  });
}
