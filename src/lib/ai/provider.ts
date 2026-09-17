/**
 * Decoupled AI provider layer.
 *
 * Every AI call in the app goes through `getAIProvider()` and the
 * `AIProvider.generateJSON` method below. Swapping Anthropic for OpenAI,
 * Gemini, etc. means writing one new adapter class and adding a branch in
 * the factory — nothing else in the app needs to change.
 */

export interface ImageInput {
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  base64Data: string;
}

export interface GenerateJSONParams {
  system: string;
  prompt: string;
  maxTokens?: number;
  /** Optional images for real vision analysis (Claude is multimodal). Only
   * used when the caller actually has image bytes — never fabricated. */
  images?: ImageInput[];
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  generateJSON(params: GenerateJSONParams): Promise<string>;
}

class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  readonly model: string;
  private client: import("@anthropic-ai/sdk").default | null = null;

  constructor(model: string) {
    this.model = model;
  }

  private async getClient() {
    if (!this.client) {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error(
          "ANTHROPIC_API_KEY is not set. Add it to your environment (see .env.example)."
        );
      }
      this.client = new Anthropic({ apiKey });
    }
    return this.client;
  }

  async generateJSON({ system, prompt, maxTokens = 4096, images }: GenerateJSONParams): Promise<string> {
    const client = await this.getClient();

    const content: import("@anthropic-ai/sdk").default.Messages.MessageParam["content"] = images?.length
      ? [
          ...images.map((img) => ({
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: img.mediaType,
              data: img.base64Data,
            },
          })),
          { type: "text" as const, text: prompt },
        ]
      : prompt;

    const message = await client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("AI provider returned no text content.");
    }
    return textBlock.text;
  }
}

/**
 * Stub adapters — not wired up, kept here so switching providers later is a
 * matter of implementing generateJSON, not restructuring the app.
 */
class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  readonly model: string;
  constructor(model: string) {
    this.model = model;
  }
  async generateJSON(): Promise<string> {
    throw new Error("OpenAI provider is not implemented yet.");
  }
}

class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  readonly model: string;
  constructor(model: string) {
    this.model = model;
  }
  async generateJSON(): Promise<string> {
    throw new Error("Gemini provider is not implemented yet.");
  }
}

let cachedProvider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (cachedProvider) return cachedProvider;

  const providerName = (process.env.AI_PROVIDER || "anthropic").toLowerCase();

  switch (providerName) {
    case "anthropic":
      cachedProvider = new AnthropicProvider(
        process.env.ANTHROPIC_MODEL || "claude-sonnet-5"
      );
      break;
    case "openai":
      cachedProvider = new OpenAIProvider(process.env.OPENAI_MODEL || "gpt-4o");
      break;
    case "gemini":
      cachedProvider = new GeminiProvider(process.env.GEMINI_MODEL || "gemini-1.5-pro");
      break;
    default:
      throw new Error(`Unknown AI_PROVIDER: ${providerName}`);
  }

  return cachedProvider;
}

/** Extracts the first top-level JSON object from a model response, tolerating
 * markdown code fences or leading/trailing prose. */
export function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in AI response.");
  }
  return candidate.slice(start, end + 1);
}
