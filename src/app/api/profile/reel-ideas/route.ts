import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateProfileReelIdeas } from "@/lib/ai/generate-profile-reel-ideas";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("profile_reel_ideas")
    .select("*")
    .order("created_at", { ascending: false });

  return NextResponse.json({ ideas: data ?? [] });
}

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("niche, target_audience, content_tone, content_goals")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.niche) {
    return NextResponse.json(
      { error: "Set your niche in Settings before generating reel ideas." },
      { status: 400 }
    );
  }

  try {
    const { ideas, model, promptVersion } = await generateProfileReelIdeas({
      niche: profile.niche,
      targetAudience: profile.target_audience,
      contentTone: profile.content_tone,
      contentGoals: profile.content_goals,
    });

    const { data, error } = await supabase
      .from("profile_reel_ideas")
      .insert(
        ideas.map((idea) => ({
          user_id: user.id,
          title: idea.title,
          hook: idea.hook,
          angle: idea.angle,
          format: idea.format,
          suggested_structure_json: idea.suggestedStructure,
          cta: idea.cta,
          model,
          prompt_version: promptVersion,
        }))
      )
      .select();

    if (error) throw new Error(error.message);

    return NextResponse.json({ ideas: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate reel ideas";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
