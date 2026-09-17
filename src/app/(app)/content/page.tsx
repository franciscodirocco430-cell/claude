import { createClient } from "@/lib/supabase/server";
import { getSignedContentUrl } from "@/lib/supabase/storage";
import { ContentLibrary, type ContentListEntry } from "@/components/content/content-library";

export const metadata = { title: "Content Library" };

export default async function ContentPage() {
  const supabase = createClient();

  const { data: items } = await supabase
    .from("content_items")
    .select("*")
    .order("created_at", { ascending: false });

  const entries: ContentListEntry[] = await Promise.all(
    (items ?? []).map(async (item) => {
      const { data: analysis } = await supabase
        .from("content_analysis")
        .select("overall_score")
        .eq("content_id", item.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const thumbnailUrl =
        item.thumbnail_url
          ? await getSignedContentUrl(supabase, item.thumbnail_url)
          : item.content_type === "static_image" || item.content_type === "ad_creative"
          ? await getSignedContentUrl(supabase, item.storage_url)
          : null;

      return { item, score: analysis?.overall_score ?? null, thumbnailUrl };
    })
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Content Library</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every piece you&apos;ve analyzed, in one place.
        </p>
      </div>
      <ContentLibrary entries={entries} />
    </div>
  );
}
