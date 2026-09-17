import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeContent } from "@/lib/ai/analyze-content";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: content, error: fetchError } = await supabase
    .from("content_items")
    .select("*")
    .eq("id", params.id)
    .single();

  if (fetchError || !content) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  await supabase
    .from("content_items")
    .update({ status: "processing" })
    .eq("id", params.id);

  const { data: existingMetrics } = await supabase
    .from("content_metrics")
    .select("id")
    .eq("content_id", params.id)
    .limit(1)
    .maybeSingle();

  const hasVideo = [
    "reel",
    "tiktok",
    "youtube_short",
    "long_form_video",
  ].includes(content.content_type);
  const hasImage = ["static_image", "ad_creative", "carousel"].includes(content.content_type);

  try {
    const { result, model, promptVersion } = await analyzeContent({
      title: content.title,
      contentType: content.content_type,
      platform: content.platform,
      goal: content.goal,
      topic: content.topic,
      campaign: null,
      transcriptOrText: content.raw_text,
      hasVideo,
      hasImage,
      durationSeconds: content.duration_seconds,
    });

    const { data: analysisRow, error: analysisError } = await supabase
      .from("content_analysis")
      .insert({
        content_id: params.id,
        overall_score: Math.round(result.overallScore),
        scores_json: result.scores,
        summary: result.summary,
        strengths_json: result.strengths,
        weaknesses_json: result.weaknesses,
        hook_analysis_json: result.hookAnalysis,
        retention_analysis_json: result.retentionAnalysis,
        structure_json: result.structureAnalysis,
        visual_analysis_json: result.visualAnalysis,
        cta_analysis_json: result.ctaAnalysis,
        audience_analysis_json: result.audienceAnalysis,
        data_completeness: existingMetrics ? "with_metrics" : "content_only",
        model,
        prompt_version: promptVersion,
      })
      .select()
      .single();

    if (analysisError) throw new Error(analysisError.message);

    if (result.recommendations.length > 0) {
      await supabase.from("recommendations").insert(
        result.recommendations.map((r) => ({
          content_id: params.id,
          title: r.title,
          why_it_matters: r.whyItMatters,
          evidence: r.evidence,
          recommended_action: r.recommendedAction,
          expected_improvement_area: r.expectedImprovementArea,
          priority: r.priority,
          suggested_rewrite: r.suggestedRewrite,
        }))
      );
    }

    if (result.nextContentIdeas.length > 0) {
      await supabase.from("content_ideas").insert(
        result.nextContentIdeas.map((idea) => ({
          content_id: params.id,
          title: idea.title,
          hook: idea.hook,
          angle: idea.angle,
          format: idea.format,
          suggested_structure_json: idea.suggestedStructure,
          cta: idea.cta,
        }))
      );
    }

    await supabase
      .from("content_items")
      .update({ status: "analyzed" })
      .eq("id", params.id);

    return NextResponse.json({ analysis: analysisRow });
  } catch (err) {
    await supabase
      .from("content_items")
      .update({ status: "failed" })
      .eq("id", params.id);

    const message = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
