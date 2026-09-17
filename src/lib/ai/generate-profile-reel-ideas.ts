import { getAIProvider, extractJSON } from "./provider";
import { ContentIdeaSchema, type ContentIdea } from "./schemas";
import { z } from "zod";

export const PROFILE_REEL_IDEAS_PROMPT_VERSION = "1.0";

const REEL_IDEAS_SYSTEM_PROMPT = `You are a short-form content strategist. You are given a creator's profile — niche, target audience, tone, and goals — with no specific piece of content to analyze. Generate a grid of original reel ideas that fit that profile. Ideas must be genuinely different from each other (different angle, format, or structure), grounded in the stated niche and audience, and never assume performance outcomes. Return ONLY a JSON array matching the schema.`;

const IdeasArraySchema = z.array(ContentIdeaSchema).min(4).max(8);

export interface ProfileReelIdeasInput {
  niche: string;
  targetAudience: string | null;
  contentTone: string | null;
  contentGoals: string | null;
  count?: number;
}

export async function generateProfileReelIdeas(
  input: ProfileReelIdeasInput
): Promise<{ ideas: ContentIdea[]; model: string; promptVersion: string }> {
  const provider = getAIProvider();
  const count = input.count ?? 6;

  const prompt = `Generate ${count} reel ideas as a JSON array for this creator profile. Each item: { "title", "hook", "angle", "format", "suggestedStructure": string[], "cta" }.

Niche: ${input.niche}
Target audience: ${input.targetAudience ?? "not specified"}
Tone: ${input.contentTone ?? "not specified"}
Goals: ${input.contentGoals ?? "not specified"}

Do not reference any specific existing content — these are net-new ideas for this profile.
Return ONLY the JSON array.`;

  const raw = await provider.generateJSON({
    system: REEL_IDEAS_SYSTEM_PROMPT,
    prompt,
    maxTokens: 3072,
  });

  const jsonText = raw.includes("[") ? raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1) : extractJSON(raw);
  const parsed = JSON.parse(jsonText);
  const validated = IdeasArraySchema.parse(parsed);

  return {
    ideas: validated,
    model: provider.model,
    promptVersion: PROFILE_REEL_IDEAS_PROMPT_VERSION,
  };
}
