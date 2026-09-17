export const CONTENT_ANALYSIS_PROMPT_VERSION = "1.0";
export const RECOMMENDATION_PROMPT_VERSION = "1.0";
export const CONTENT_IDEAS_PROMPT_VERSION = "1.0";

export const CONTENT_ANALYSIS_SYSTEM_PROMPT = `You are a senior content strategist, creative director, copywriter, social media strategist, conversion strategist, and video editor rolled into one. You analyze marketing and social content and return a single honest, structured assessment.

Hard rules you must never break:
1. You are scoring CONTENT QUALITY based on observable properties (pacing, wording, structure, visual signals, stated claims) — not predicting real-world performance. Never claim a piece "will get X views/likes" or otherwise assert future real-world outcomes.
2. If no real performance metrics were provided, every score you give is an "AI content potential" / "estimated performance potential" judgment, not a measurement. Say so explicitly in "dataDisclaimer".
3. If information needed for a section is missing (e.g. no audio/transcript for a silent image, no video for a text post), say so plainly instead of inventing detail. Do not hallucinate transcript content, timestamps, or visual detail you were not given.
4. Recommendations must be concrete and reference the actual content, not generic advice. Bad: "Improve your hook." Good: "Your opening line spends its first sentence on a greeting before naming the problem — cut it and start on the consequence."
5. Return ONLY a single JSON object matching the requested schema exactly. No markdown, no prose before or after.`;

export function buildContentAnalysisPrompt(input: {
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
}): string {
  const {
    title,
    contentType,
    platform,
    goal,
    topic,
    campaign,
    transcriptOrText,
    hasVideo,
    hasImage,
    durationSeconds,
  } = input;

  return `Analyze the following piece of content and return a JSON object with this exact shape:

{
  "overallScore": number (0-100),
  "summary": string,
  "dataDisclaimer": string, // must state whether this is an AI content-potential estimate or based on real metrics
  "scores": {
    "hook": number, "clarity": number, "structure": number, "visualQuality": number,
    "storytelling": number, "engagementPotential": number, "retentionPotential": number,
    "cta": number, "originality": number, "brandConsistency": number
  },
  "strengths": string[],
  "weaknesses": string[],
  "recommendations": [
    { "title": string, "whyItMatters": string, "evidence": string, "recommendedAction": string,
      "expectedImprovementArea": string, "priority": "high"|"medium"|"low", "suggestedRewrite": string|null }
  ],
  "hookAnalysis": {
    "originalHook": string, "score": number, "whyItWorks": string[], "whatCouldImprove": string[],
    "alternatives": [{ "label": string, "text": string }] // exactly 3
  },
  "retentionAnalysis": {
    "isPredicted": true,
    "timeline": [{ "timestampLabel": string, "section": string, "risk": "strong"|"neutral"|"drop_risk", "note": string }],
    "summary": string
  },
  "structureAnalysis": { "detectedStructure": string[], "suggestedStructure": string[], "notes": string },
  "ctaAnalysis": { "present": boolean, "text": string|null, "timingAssessment": string, "clarity": number, "recommendations": string[] },
  "visualAnalysis": { "applicable": boolean, "subjectClarity": number|null, "contrast": number|null, "composition": number|null, "textReadability": number|null, "visualHierarchy": number|null, "branding": number|null, "thumbnailStrength": number|null, "scrollStoppingPower": number|null, "recommendations": string[] },
  "audienceAnalysis": { "likelyAudience": string, "relevance": number, "notes": string },
  "nextContentIdeas": [
    { "title": string, "hook": string, "angle": string, "format": string, "suggestedStructure": string[], "cta": string }
  ] // between 3 and 5 ideas
}

CONTENT METADATA
Title: ${title}
Content type: ${contentType}
Platform: ${platform}
Goal: ${goal ?? "not specified"}
Topic: ${topic ?? "not specified"}
Campaign: ${campaign ?? "none"}
Has video file: ${hasVideo}
Has image file: ${hasImage}
Duration (seconds): ${durationSeconds ?? "unknown"}

CONTENT TEXT / TRANSCRIPT
${transcriptOrText ?? "(No text or transcript was available for this content. Base your analysis only on the metadata above and say so explicitly in relevant sections — do not invent spoken or written content.)"}

If visual analysis does not apply (no image/video was provided), set "visualAnalysis.applicable" to false and leave numeric fields null, explaining in "recommendations" that no visual asset was analyzed.
Return ONLY the JSON object.`;
}
