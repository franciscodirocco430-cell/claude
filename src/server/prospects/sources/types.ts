import type { RawProspect } from "../candidate";

/**
 * Origen de los datos que trae una fuente. Por las reglas de cumplimiento
 * (CLAUDE.md) solo se admiten APIs oficiales y directorios públicos de
 * NEGOCIOS. Nunca perfiles ni seguidores de Instagram, TikTok o Facebook.
 */
export type SourceDataOrigin = "official_business_api" | "public_business_directory";

export interface SourceQuery {
  /** Qué buscar, ej. "odontólogos". */
  term: string;
  /** Dónde, ej. "Palermo, CABA". */
  location?: string;
  limit?: number;
}

export interface SourceResult {
  /** Id estable en la fuente, para trazabilidad (prospects.source_ref). */
  externalId: string;
  prospect: RawProspect;
}

export interface CostInfo {
  /**
   * Descripción del costo VERIFICADA por una persona, con fecha y link a la
   * página oficial de precios. Mientras sea null la fuente no se puede activar.
   */
  verifiedSummary: string | null;
  pricingUrl: string;
}

export interface ProspectSource {
  id: string;
  label: string;
  dataOrigin: SourceDataOrigin;
  cost: CostInfo;
  /** Variable de entorno que la habilita explícitamente. */
  enableEnvVar: string;
  search(query: SourceQuery): Promise<SourceResult[]>;
}
