import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateContentIdeas } from "@/lib/ai/generate-content-ideas";

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
      { error: "This content needs to be analyzed before ideas can be generated." },
      { status: 400 }
    );
  }

  try {
    const { ideas } = await generateContentIdeas({
      title: content.title,
      contentType: content.content_type,
      platform: content.platform,
      topic: content.topic,
      summary: analysis.summary ?? "",
    });

    await supabase.from("content_ideas").delete().eq("content_id", params.id);
    const { data, error } = await supabase
      .from("content_ideas")
      .insert(
        ideas.map((idea) => ({
          content_id: params.id,
          title: idea.title,
          hook: idea.hook,
          angle: idea.angle,
          format: idea.format,
          suggested_structure_json: idea.suggestedStructure,
          cta: idea.cta,
        }))
      )
      .select();

    if (error) throw new Error(error.message);

    return NextResponse.json({ ideas: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate ideas";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
