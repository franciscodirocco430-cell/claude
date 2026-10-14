import type { ServerEnv } from "@/lib/env";
import { DomainError } from "@/server/errors";

export type AiTier = "fast" | "smart";
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface TierConfig {
  model: string;
  effort: Effort | null;
  /** USD por millón de tokens; null si no está configurado (el costo queda en null). */
  priceInputPerMTok: number | null;
  priceOutputPerMTok: number | null;
}

export interface AiConfig {
  fast: TierConfig;
  smart: TierConfig;
}

type AiEnv = Pick<
  ServerEnv,
  | "AI_MODEL_FAST"
  | "AI_MODEL_SMART"
  | "AI_EFFORT_FAST"
  | "AI_EFFORT_SMART"
  | "AI_PRICE_FAST_INPUT_PER_MTOK"
  | "AI_PRICE_FAST_OUTPUT_PER_MTOK"
  | "AI_PRICE_SMART_INPUT_PER_MTOK"
  | "AI_PRICE_SMART_OUTPUT_PER_MTOK"
>;

/** Los modelos salen SIEMPRE de variables de entorno: nunca se hardcodean. */
export function aiConfigFromEnv(env: AiEnv): AiConfig {
  if (!env.AI_MODEL_FAST || !env.AI_MODEL_SMART) {
    throw new DomainError("ai_not_configured", "Faltan AI_MODEL_FAST y/o AI_MODEL_SMART.");
  }
  const effort = (e: AiEnv["AI_EFFORT_FAST"]) => (e === "none" ? null : e);
  return {
    fast: {
      model: env.AI_MODEL_FAST,
      effort: effort(env.AI_EFFORT_FAST),
      priceInputPerMTok: env.AI_PRICE_FAST_INPUT_PER_MTOK ?? null,
      priceOutputPerMTok: env.AI_PRICE_FAST_OUTPUT_PER_MTOK ?? null,
    },
    smart: {
      model: env.AI_MODEL_SMART,
      effort: effort(env.AI_EFFORT_SMART),
      priceInputPerMTok: env.AI_PRICE_SMART_INPUT_PER_MTOK ?? null,
      priceOutputPerMTok: env.AI_PRICE_SMART_OUTPUT_PER_MTOK ?? null,
    },
  };
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
}

/**
 * Costo ESTIMADO en USD. Escritura de caché a 1,25× y lectura a 0,1× del precio
 * de entrada. No contempla precios escalonados por tamaño de prompt: es una
 * estimación para métricas, no una factura.
 */
export function estimateCostUsd(usage: TokenUsage, tier: TierConfig): number | null {
  if (tier.priceInputPerMTok === null || tier.priceOutputPerMTok === null) return null;
  const inPrice = tier.priceInputPerMTok / 1_000_000;
  const outPrice = tier.priceOutputPerMTok / 1_000_000;
  const cost =
    usage.inputTokens * inPrice +
    (usage.cacheCreationInputTokens ?? 0) * inPrice * 1.25 +
    (usage.cacheReadInputTokens ?? 0) * inPrice * 0.1 +
    usage.outputTokens * outPrice;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
