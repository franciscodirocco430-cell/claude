import { createClient } from "@/lib/supabase/server";
import { CompareView } from "@/components/content/compare-view";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata = { title: "Compare Content" };

export default async function ComparePage() {
  const supabase = createClient();

  const { data: items } = await supabase
    .from("content_items")
    .select("*")
    .eq("status", "analyzed")
    .order("created_at", { ascending: false });

  if (!items || items.length < 2) {
    return (
      <EmptyState
        title="Not enough content to compare yet"
        description="Analyze at least two pieces of content to compare their scores and performance."
        ctaHref="/content/new"
        ctaLabel="Analyze content"
      />
    );
  }

  const { data: analyses } = await supabase
    .from("content_analysis")
    .select("*")
    .in(
      "content_id",
      items.map((i) => i.id)
    );

  const { data: metrics } = await supabase
    .from("content_metrics")
    .select("*")
    .in(
      "content_id",
      items.map((i) => i.id)
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Compare Content</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Side-by-side scores and, where available, real performance data.
        </p>
      </div>
      <CompareView items={items} analyses={analyses ?? []} metrics={metrics ?? []} />
    </div>
  );
}
