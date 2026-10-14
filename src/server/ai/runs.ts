import type { DbExecutor } from "@/db/rls";
import type { aiRunType } from "@/db/schema";
import { aiRuns } from "@/db/schema";
import type { AiError } from "./client";
import { estimateCostUsd, type TierConfig, type TokenUsage } from "./config";

export type AiRunType = (typeof aiRunType.enumValues)[number];

/** Registra una decisión de la IA (éxito o error) para auditoría y costos. */
export async function recordAiRun(
  db: DbExecutor,
  input: {
    organizationId: string;
    type: AiRunType;
    tier: TierConfig;
    model?: string;
    promptVersion: string;
    inputSummary: string;
    output?: unknown;
    usage?: TokenUsage;
    durationMs?: number;
    error?: AiError | Error;
    prospectId?: string | null;
    conversationId?: string | null;
  },
) {
  const usage = input.usage ?? { inputTokens: 0, outputTokens: 0 };
  const cost = estimateCostUsd(usage, input.tier);
  const [row] = await db
    .insert(aiRuns)
    .values({
      organizationId: input.organizationId,
      type: input.type,
      model: input.model ?? input.tier.model,
      promptVersion: input.promptVersion,
      inputSummary: input.inputSummary.slice(0, 1000),
      output: input.output ?? null,
      inputTokens:
        usage.inputTokens +
        (usage.cacheCreationInputTokens ?? 0) +
        (usage.cacheReadInputTokens ?? 0),
      outputTokens: usage.outputTokens,
      costUsd: cost === null ? null : cost.toFixed(6),
      durationMs: input.durationMs ?? null,
      status: input.error ? "error" : "ok",
      error: input.error ? input.error.message.slice(0, 1000) : null,
      prospectId: input.prospectId ?? null,
      conversationId: input.conversationId ?? null,
    })
    .returning({ id: aiRuns.id });
  return row!.id;
}
