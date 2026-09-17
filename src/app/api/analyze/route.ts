import { NextResponse } from "next/server";
import { analyzeContent } from "@/lib/ai/analyze-content";
import { AnalyzeRequestSchema } from "@/lib/validations/content";

/**
 * Stateless analysis endpoint: nothing is persisted. The request carries
 * everything needed (metadata, pasted text/caption, and optionally raw
 * image bytes for real vision analysis); the response carries the full
 * result straight back to the browser.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = AnalyzeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const input = parsed.data;

  const hasVideo = ["reel", "tiktok", "youtube_short", "long_form_video"].includes(
    input.contentType
  );
  // Only true when real image bytes were actually attached — never inferred
  // from contentType alone, or the AI would be told an image exists when it
  // doesn't (e.g. a "carousel" analyzed from pasted caption text only).
  const hasImage = Boolean(input.image);

  try {
    const { result, model, promptVersion } = await analyzeContent({
      title: input.title,
      contentType: input.contentType,
      platform: input.platform,
      goal: input.goal ?? null,
      topic: input.topic ?? null,
      campaign: null,
      transcriptOrText: input.rawText ?? null,
      hasVideo,
      hasImage,
      durationSeconds: input.durationSeconds ?? null,
      image: input.image ?? undefined,
    });

    return NextResponse.json({ analysis: result, model, promptVersion });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
