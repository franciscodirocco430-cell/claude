import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/shared/empty-state";
import { RecommendationsFeed } from "@/components/analysis/recommendations-feed";

export const metadata = { title: "Recommendations" };

export default async function RecommendationsPage() {
  const supabase = createClient();

  const { data: items } = await supabase.from("content_items").select("id, title, platform, content_type");
  const contentIds = (items ?? []).map((i) => i.id);

  const { data: recommendations } = await supabase
    .from("recommendations")
    .select("*")
    .in("content_id", contentIds)
    .order("created_at", { ascending: false });

  if (!recommendations || recommendations.length === 0) {
    return (
      <EmptyState
        title="No recommendations yet"
        description="Analyze content to get concrete, evidence-based recommendations here."
        ctaHref="/content/new"
        ctaLabel="Analyze content"
      />
    );
  }

  const itemById = new Map((items ?? []).map((i) => [i.id, i]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Recommendations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every concrete recommendation generated across your content, in one place.
        </p>
      </div>
      <RecommendationsFeed
        recommendations={recommendations}
        titleByContentId={Object.fromEntries(
          Array.from(itemById.entries()).map(([id, i]) => [id, i.title])
        )}
      />
    </div>
  );
}
