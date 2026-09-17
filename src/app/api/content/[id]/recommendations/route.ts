import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { regenerateRecommendations } from "@/lib/ai/recommend-content";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ data: content }, { data: analysis }] = await Promise.all([
    supabase.from("content_items").select("*").eq("id", params.id).single(),
    supabase
      .from("content_analysis")
      .select("*")
      .eq("content_id", params.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!content || !analysis) {
    return NextResponse.json(
      { error: "This content needs to be analyzed before recommendations can be generated." },
      { status: 400 }
    );
  }

  try {
    const { recommendations } = await regenerateRecommendations({
      title: content.title,
      contentType: content.content_type,
      summary: analysis.summary ?? "",
      strengths: analysis.strengths_json ?? [],
      weaknesses: analysis.weaknesses_json ?? [],
      scores: analysis.scores_json ?? {},
    });

    await supabase.from("recommendations").delete().eq("content_id", params.id);
    const { data, error } = await supabase
      .from("recommendations")
      .insert(
        recommendations.map((r) => ({
          content_id: params.id,
          title: r.title,
          why_it_matters: r.whyItMatters,
          evidence: r.evidence,
          recommended_action: r.recommendedAction,
          expected_improvement_area: r.expectedImprovementArea,
          priority: r.priority,
          suggested_rewrite: r.suggestedRewrite,
        }))
      )
      .select();

    if (error) throw new Error(error.message);

    return NextResponse.json({ recommendations: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate recommendations";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
