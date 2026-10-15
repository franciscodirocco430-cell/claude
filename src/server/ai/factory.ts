import Anthropic from "@anthropic-ai/sdk";
import type { ServerEnv } from "@/lib/env";
import { AnthropicAiClient, type AiClient } from "./client";
import { aiConfigFromEnv, type AiConfig } from "./config";
import { FakeAiClient } from "./fake-client";

type FactoryEnv = Parameters<typeof aiConfigFromEnv>[0] &
  Pick<ServerEnv, "AI_FAKE" | "NODE_ENV" | "ANTHROPIC_API_KEY" | "ANTHROPIC_WORKSPACE_ID">;

export function createAiClient(env: FactoryEnv): { client: AiClient; config: AiConfig } {
  if (env.AI_FAKE === "true") {
    if (env.NODE_ENV === "production") {
      throw new Error("AI_FAKE=true no está permitido en producción.");
    }
    const config = aiConfigFromEnv({
      ...env,
      AI_MODEL_FAST: env.AI_MODEL_FAST ?? "fake-fast",
      AI_MODEL_SMART: env.AI_MODEL_SMART ?? "fake-smart",
    });
    return { client: new FakeAiClient(), config };
  }
  const config = aiConfigFromEnv(env);
  const sdk = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    defaultHeaders: env.ANTHROPIC_WORKSPACE_ID
      ? { "anthropic-workspace-id": env.ANTHROPIC_WORKSPACE_ID }
      : undefined,
  });
  return { client: new AnthropicAiClient(config, sdk), config };
}
