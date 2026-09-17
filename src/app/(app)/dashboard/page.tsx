import { createClient } from "@/lib/supabase/server";
import { DashboardGrid, type DashboardData } from "@/components/dashboard/dashboard-grid";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDate } from "@/lib/utils";
import type { Database } from "@/lib/types/database.types";

type ContentAnalysisRow = Database["public"]["Tables"]["content_analysis"]["Row"];

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = createClient();

  const { data: items } = await supabase
    .from("content_items")
    .select("*")
    .order("created_at", { ascending: false });

  if (!items || items.length === 0) {
    return (
      <EmptyState
        title="Your content intelligence starts here."
        description="Upload your first Reel, video, image or post and discover what you can improve."
        ctaHref="/content/new"
        ctaLabel="Analyze your first content"
      />
    );
  }

  const { data: analyses } = await supabase
    .from("content_analysis")
    .select("*")
    .in(
      "content_id",
      items.map((i) => i.id)
    )
    .order("created_at", { ascending: true });

  const contentIds = items.map((i) => i.id);

  const { data: recommendations } = await supabase
    .from("recommendations")
    .select("*")
    .in("content_id", contentIds);

  const { data: ideas } = await supabase.from("content_ideas").select("*").in("content_id", contentIds);

  const { data: layoutRow } = await supabase
    .from("dashboard_layouts")
    .select("layout_json")
    .eq("user_id", items[0].user_id)
    .maybeSingle();

  // Latest analysis per content item
  const latestByContent = new Map<string, ContentAnalysisRow>();
  (analyses ?? []).forEach((a) => latestByContent.set(a.content_id, a));

  const itemById = new Map(items.map((i) => [i.id, i]));

  const scoredEntries = Array.from(latestByContent.entries()).map(([contentId, analysis]) => ({
    contentId,
    item: itemById.get(contentId)!,
    analysis,
  }));

  const overallScores = scoredEntries.map((e) => e.analysis.overall_score);
  const overallScore =
    overallScores.length > 0 ? overallScores.reduce((a, b) => a + b, 0) / overallScores.length : null;

  const half = Math.floor(scoredEntries.length / 2);
  const scoreChange =
    scoredEntries.length >= 4
      ? scoredEntries.slice(half).reduce((a, e) => a + e.analysis.overall_score, 0) / (scoredEntries.length - half) -
        scoredEntries.slice(0, half).reduce((a, e) => a + e.analysis.overall_score, 0) / half
      : null;

  const countsByType: Record<string, number> = {};
  items.forEach((i) => {
    countsByType[i.content_type] = (countsByType[i.content_type] ?? 0) + 1;
  });

  const scoresByFormat = new Map<string, number[]>();
  scoredEntries.forEach((e) => {
    const list = scoresByFormat.get(e.item.content_type) ?? [];
    list.push(e.analysis.overall_score);
    scoresByFormat.set(e.item.content_type, list);
  });
  let bestFormat: { format: string; avgScore: number } | null = null;
  scoresByFormat.forEach((scores, format) => {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (!bestFormat || avg > bestFormat.avgScore) bestFormat = { format, avgScore: avg };
  });

  const avgOf = (key: string) => {
    const values = scoredEntries
      .map((e) => (e.analysis.scores_json as Record<string, number>)?.[key])
      .filter((v): v is number => typeof v === "number");
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
  };

  const topContent = [...scoredEntries]
    .sort((a, b) => b.analysis.overall_score - a.analysis.overall_score)
    .slice(0, 5)
    .map((e) => ({
      id: e.contentId,
      title: e.item.title,
      platform: e.item.platform,
      score: e.analysis.overall_score,
      createdAt: e.item.created_at,
    }));

  const recentContent = items.slice(0, 5).map((i) => ({
    id: i.id,
    title: i.title,
    platform: i.platform,
    score: latestByContent.get(i.id)?.overall_score ?? null,
    createdAt: i.created_at,
  }));

  const topRecommendations = (recommendations ?? [])
    .sort((a, b) => {
      const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
    })
    .slice(0, 3)
    .map((r) => ({ id: r.id, contentId: r.content_id, title: r.title, priority: r.priority }));

  const opportunities = (ideas ?? []).slice(0, 4).map((idea) => ({
    id: idea.id,
    contentId: idea.content_id,
    title: idea.title,
    format: idea.format,
  }));

  const formatDistribution = Object.entries(countsByType).map(([format, count]) => ({
    format: format.replace(/_/g, " "),
    count,
  }));

  const scoreEvolution = scoredEntries
    .sort((a, b) => new Date(a.analysis.created_at).getTime() - new Date(b.analysis.created_at).getTime())
    .map((e) => ({ date: formatDate(e.analysis.created_at), score: e.analysis.overall_score }));

  const dashboardData: DashboardData = {
    overallScore,
    scoreChange,
    totalAnalyzed: items.length,
    countsByType,
    bestFormat,
    avgHook: avgOf("hook"),
    avgRetention: avgOf("retentionPotential"),
    avgCta: avgOf("cta"),
    topContent,
    recentContent,
    recommendations: topRecommendations,
    opportunities,
    formatDistribution,
    scoreEvolution,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Drag widgets to reorder — your layout is saved automatically.
        </p>
      </div>
      <DashboardGrid data={dashboardData} initialLayout={(layoutRow?.layout_json as string[]) ?? null} />
    </div>
  );
}
