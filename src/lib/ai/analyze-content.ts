import { getAIProvider, extractJSON } from "./provider";
import {
  CONTENT_ANALYSIS_PROMPT_VERSION,
  CONTENT_ANALYSIS_SYSTEM_PROMPT,
  buildContentAnalysisPrompt,
} from "./prompts";
import { ContentAnalysisResultSchema, type ContentAnalysisResult } from "./schemas";

export interface AnalyzeContentInput {
  title: string;
  contentType: string;
  platform: string;
  goal: string | null;
  topic: string | null;
  campaign: string | null;
  transcriptOrText: string | null;
  hasVideo: boolean;
  hasImage: boolean;
  durationSeconds: number | null;
}

export interface AnalyzeContentOutput {
  result: ContentAnalysisResult;
  model: string;
  promptVersion: string;
}

/**
 * Runs a full content analysis through the configured AI provider and
 * validates the response against ContentAnalysisResultSchema. Retries once
 * with a stricter reminder if the first response fails validation, since
 * LLMs occasionally drop a required field.
 */
export async function analyzeContent(
  input: AnalyzeContentInput
): Promise<AnalyzeContentOutput> {
  const provider = getAIProvider();
  const prompt = buildContentAnalysisPrompt(input);

  const attempt = async (extraInstruction?: string) => {
    const raw = await provider.generateJSON({
      system: CONTENT_ANALYSIS_SYSTEM_PROMPT,
      prompt: extraInstruction ? `${prompt}\n\n${extraInstruction}` : prompt,
      maxTokens: 4096,
    });
    const json = extractJSON(raw);
    return JSON.parse(json);
  };

  let parsed = await attempt();
  let validated = ContentAnalysisResultSchema.safeParse(parsed);

  if (!validated.success) {
    parsed = await attempt(
      `Your previous response did not match the required schema exactly (missing or malformed fields: ${validated.error.issues
        .slice(0, 5)
        .map((i) => i.path.join("."))
        .join(", ")}). Return the corrected JSON object only, matching the schema precisely.`
    );
    validated = ContentAnalysisResultSchema.safeParse(parsed);
  }

  if (!validated.success) {
    throw new Error(
      `AI analysis response failed schema validation: ${validated.error.message}`
    );
  }

  return {
    result: validated.data,
    model: provider.model,
    promptVersion: CONTENT_ANALYSIS_PROMPT_VERSION,
  };
}
