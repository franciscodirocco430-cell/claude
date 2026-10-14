import type { ServerEnv } from "@/lib/env";
import { AnthropicAiClient, type AiClient } from "./client";
import { aiConfigFromEnv, type AiConfig } from "./config";
import { FakeAiClient } from "./fake-client";

type FactoryEnv = Parameters<typeof aiConfigFromEnv>[0] &
  Pick<ServerEnv, "AI_FAKE" | "NODE_ENV" | "ANTHROPIC_API_KEY">;

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
  return { client: new AnthropicAiClient(config), config };
}
