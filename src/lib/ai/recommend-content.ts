import { getAIProvider, extractJSON } from "./provider";
import { RECOMMENDATION_PROMPT_VERSION } from "./prompts";
import { RecommendationSchema, type Recommendation } from "./schemas";
import { z } from "zod";

const RECOMMENDATIONS_SYSTEM_PROMPT = `You are a conversion strategist and creative director. You are given an existing AI content analysis and asked to produce a fresh, sharper batch of recommendations. Every recommendation must cite specific evidence from the analysis provided — never generic advice. Return ONLY a JSON array matching the schema.`;

const RecommendationsArraySchema = z.array(RecommendationSchema).min(1).max(6);

export interface RegenerateRecommendationsInput {
  title: string;
  contentType: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  scores: Record<string, number>;
}

/**
 * Regenerates the recommendations list for a piece of content that already
 * has an analysis on file. Used by the "Generate Recommendations" action on
 * the analysis page, independent from the initial analysis pass.
 */
export async function regenerateRecommendations(
  input: RegenerateRecommendationsInput
): Promise<{ recommendations: Recommendation[]; model: string; promptVersion: string }> {
  const provider = getAIProvider();

  const prompt = `Based on this existing content analysis, produce between 3 and 6 concrete, non-generic recommendations as a JSON array. Each item: { "title", "whyItMatters", "evidence", "recommendedAction", "expectedImprovementArea", "priority": "high"|"medium"|"low", "suggestedRewrite": string|null }.

Title: ${input.title}
Content type: ${input.contentType}
Summary: ${input.summary}
Strengths: ${input.strengths.join("; ")}
Weaknesses: ${input.weaknesses.join("; ")}
Scores: ${JSON.stringify(input.scores)}

Return ONLY the JSON array.`;

  const raw = await provider.generateJSON({
    system: RECOMMENDATIONS_SYSTEM_PROMPT,
    prompt,
    maxTokens: 2048,
  });

  const jsonText = raw.includes("[") ? raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1) : extractJSON(raw);
  const parsed = JSON.parse(jsonText);
  const validated = RecommendationsArraySchema.parse(parsed);

  return {
    recommendations: validated,
    model: provider.model,
    promptVersion: RECOMMENDATION_PROMPT_VERSION,
  };
}
