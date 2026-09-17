import { getAIProvider, extractJSON } from "./provider";
import { CONTENT_IDEAS_PROMPT_VERSION } from "./prompts";
import { ContentIdeaSchema, type ContentIdea } from "./schemas";
import { z } from "zod";

const IDEAS_SYSTEM_PROMPT = `You are a social media strategist generating a "create your next post" set of ideas from a piece of already-analyzed content. Ideas should give the creator genuinely different angles (contrarian take, case study, beginner explanation, common mistakes, story-based version, etc.), not five versions of the same idea. Return ONLY a JSON array matching the schema.`;

const IdeasArraySchema = z.array(ContentIdeaSchema).min(3).max(5);

export interface GenerateContentIdeasInput {
  title: string;
  contentType: string;
  platform: string;
  topic: string | null;
  summary: string;
}

export async function generateContentIdeas(
  input: GenerateContentIdeasInput
): Promise<{ ideas: ContentIdea[]; model: string; promptVersion: string }> {
  const provider = getAIProvider();

  const prompt = `Based on this content, generate between 3 and 5 next-content ideas as a JSON array. Each item: { "title", "hook", "angle", "format", "suggestedStructure": string[], "cta" }.

Title: ${input.title}
Content type: ${input.contentType}
Platform: ${input.platform}
Topic: ${input.topic ?? "not specified"}
Summary of original content: ${input.summary}

Return ONLY the JSON array.`;

  const raw = await provider.generateJSON({
    system: IDEAS_SYSTEM_PROMPT,
    prompt,
    maxTokens: 2048,
  });

  const jsonText = raw.includes("[") ? raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1) : extractJSON(raw);
  const parsed = JSON.parse(jsonText);
  const validated = IdeasArraySchema.parse(parsed);

  return {
    ideas: validated,
    model: provider.model,
    promptVersion: CONTENT_IDEAS_PROMPT_VERSION,
  };
}
