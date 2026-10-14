import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import type { AiConfig, AiTier, TokenUsage } from "./config";

export interface StructuredRequest<S extends z.ZodType> {
  tier: AiTier;
  system: string;
  user: string;
  schema: S;
  maxTokens?: number;
  /** Para el cliente simulado: qué tarea es (los reales lo ignoran). */
  task: string;
}

export interface StructuredResult<T> {
  data: T;
  model: string;
  usage: TokenUsage;
  durationMs: number;
}

/** Error de IA con causa clasificada, para registrar en ai_runs y decidir reintentos. */
export class AiError extends Error {
  constructor(
    public readonly kind: "refusal" | "truncated" | "invalid_output" | "api" | "config",
    message: string,
    public readonly retryable: boolean,
    public readonly model?: string,
    public readonly usage?: TokenUsage,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export interface AiClient {
  generateStructured<S extends z.ZodType>(
    req: StructuredRequest<S>,
  ): Promise<StructuredResult<z.infer<S>>>;
}

/** Cliente real sobre el SDK oficial de Anthropic, con salida estructurada validada por Zod. */
export class AnthropicAiClient implements AiClient {
  constructor(
    private readonly config: AiConfig,
    private readonly sdk: Anthropic = new Anthropic(),
  ) {}

  async generateStructured<S extends z.ZodType>(
    req: StructuredRequest<S>,
  ): Promise<StructuredResult<z.infer<S>>> {
    const tier = this.config[req.tier];
    const started = Date.now();
    let response;
    try {
      response = await this.sdk.messages.parse({
        model: tier.model,
        max_tokens: req.maxTokens ?? 16000,
        system: req.system,
        messages: [{ role: "user", content: req.user }],
        output_config: {
          format: zodOutputFormat(req.schema),
          ...(tier.effort ? { effort: tier.effort } : {}),
        },
      });
    } catch (error) {
      if (
        error instanceof Anthropic.RateLimitError ||
        error instanceof Anthropic.InternalServerError
      ) {
        throw new AiError("api", `API de IA no disponible: ${error.message}`, true, tier.model);
      }
      if (error instanceof Anthropic.APIConnectionError) {
        throw new AiError(
          "api",
          `Sin conexión con la API de IA: ${error.message}`,
          true,
          tier.model,
        );
      }
      if (error instanceof Anthropic.APIError) {
        // 400/401/403/404: reintentar no lo arregla.
        throw new AiError(
          "api",
          `Error de la API de IA (${error.status}): ${error.message}`,
          false,
          tier.model,
        );
      }
      throw error;
    }

    const usage: TokenUsage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
      cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
    };
    if (response.stop_reason === "refusal") {
      const category = response.stop_details?.category ?? "sin categoría";
      throw new AiError(
        "refusal",
        `El modelo rechazó la tarea (${category}).`,
        false,
        response.model,
        usage,
      );
    }
    if (response.stop_reason === "max_tokens") {
      throw new AiError(
        "truncated",
        "La respuesta se cortó por max_tokens.",
        false,
        response.model,
        usage,
      );
    }
    const parsed = req.schema.safeParse(response.parsed_output);
    if (!parsed.success) {
      throw new AiError(
        "invalid_output",
        "La respuesta no respetó el formato esperado.",
        true,
        response.model,
        usage,
      );
    }
    return { data: parsed.data, model: response.model, usage, durationMs: Date.now() - started };
  }
}
