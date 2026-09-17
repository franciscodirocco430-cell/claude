import { createClient } from "@/lib/supabase/server";
import { ReelIdeasGrid } from "@/components/content/reel-ideas-grid";

export const metadata = { title: "Reel Ideas" };

export default async function IdeasPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("niche, target_audience, content_tone, content_goals")
    .eq("id", user!.id)
    .maybeSingle();

  const { data: ideas } = await supabase
    .from("profile_reel_ideas")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Reel Ideas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fresh reel ideas generated from your creator profile — not tied to any single piece of content.
        </p>
      </div>
      <ReelIdeasGrid hasNiche={Boolean(profile?.niche)} ideas={ideas ?? []} />
    </div>
  );
}
