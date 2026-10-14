import { DomainError } from "@/server/errors";
import { googlePlacesSource } from "./google-places";
import type { ProspectSource, SourceDataOrigin } from "./types";

const ALLOWED_ORIGINS: readonly SourceDataOrigin[] = [
  "official_business_api",
  "public_business_directory",
];

export const PROSPECT_SOURCES: readonly ProspectSource[] = [googlePlacesSource];

export type SourceAvailability =
  | { available: true }
  | { available: false; reason: "cost_not_verified" | "disabled" | "forbidden_origin" };

/**
 * Una fuente solo se puede usar si: su origen está permitido, alguien verificó
 * y documentó el costo, y está habilitada explícitamente por variable de entorno.
 */
export function sourceAvailability(
  source: ProspectSource,
  env: Record<string, string | undefined> = process.env,
): SourceAvailability {
  if (!ALLOWED_ORIGINS.includes(source.dataOrigin)) {
    return { available: false, reason: "forbidden_origin" };
  }
  if (!source.cost.verifiedSummary) return { available: false, reason: "cost_not_verified" };
  if (env[source.enableEnvVar] !== "true") return { available: false, reason: "disabled" };
  return { available: true };
}

export function getAvailableSource(id: string, env?: Record<string, string | undefined>) {
  const source = PROSPECT_SOURCES.find((s) => s.id === id);
  if (!source) throw new DomainError("not_found", "Esa fuente de datos no existe.");
  const availability = sourceAvailability(source, env);
  if (!availability.available) {
    throw new DomainError("source_unavailable", `La fuente ${source.label} no está habilitada.`);
  }
  return source;
}
