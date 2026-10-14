import { describe, expect, it } from "vitest";
import { aiConfigFromEnv, estimateCostUsd } from "./config";

const env = {
  AI_MODEL_FAST: "modelo-rapido",
  AI_MODEL_SMART: "modelo-inteligente",
  AI_EFFORT_FAST: "low" as const,
  AI_EFFORT_SMART: "none" as const,
  AI_PRICE_FAST_INPUT_PER_MTOK: 1,
  AI_PRICE_FAST_OUTPUT_PER_MTOK: 5,
  AI_PRICE_SMART_INPUT_PER_MTOK: undefined,
  AI_PRICE_SMART_OUTPUT_PER_MTOK: undefined,
};

describe("configuración de IA", () => {
  it("toma modelos y esfuerzo del entorno", () => {
    const c = aiConfigFromEnv(env);
    expect(c.fast).toMatchObject({ model: "modelo-rapido", effort: "low" });
    expect(c.smart).toMatchObject({ model: "modelo-inteligente", effort: null });
  });

  it("exige los dos modelos", () => {
    expect(() => aiConfigFromEnv({ ...env, AI_MODEL_SMART: undefined })).toThrow(/AI_MODEL_SMART/);
  });

  it("estima el costo incluyendo caché", () => {
    const c = aiConfigFromEnv(env);
    expect(
      estimateCostUsd(
        {
          inputTokens: 1_000_000,
          outputTokens: 100_000,
          cacheCreationInputTokens: 100_000,
          cacheReadInputTokens: 1_000_000,
        },
        c.fast,
      ),
    ).toBe(1 + 0.5 + 0.125 + 0.1);
  });

  it("sin precios configurados el costo es null", () => {
    expect(
      estimateCostUsd({ inputTokens: 10, outputTokens: 10 }, aiConfigFromEnv(env).smart),
    ).toBeNull();
  });
});
