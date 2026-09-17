import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSignedContentUrl } from "@/lib/supabase/storage";
import { OverallScore } from "@/components/analysis/overall-score";
import { ScoreBreakdown } from "@/components/analysis/score-breakdown";
import { HookAnalysis } from "@/components/analysis/hook-analysis";
import { RetentionAnalysis } from "@/components/analysis/retention-analysis";
import { VisualAnalysis } from "@/components/analysis/visual-analysis";
import { RecommendationsList } from "@/components/analysis/recommendations-list";
import { NextContentIdeas } from "@/components/analysis/next-content-ideas";
import { MetricsForm } from "@/components/analysis/metrics-form";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";

export default async function ContentDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: content } = await supabase
    .from("content_items")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!content) notFound();

  const [{ data: analysis }, { data: metrics }, { data: recommendations }, { data: ideas }] =
    await Promise.all([
      supabase
        .from("content_analysis")
        .select("*")
        .eq("content_id", params.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("content_metrics")
        .select("*")
        .eq("content_id", params.id)
        .order("captured_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("recommendations").select("*").eq("content_id", params.id),
      supabase.from("content_ideas").select("*").eq("content_id", params.id),
    ]);

  const previewUrl = await getSignedContentUrl(supabase, content.storage_url);

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/[0.04]">
            {previewUrl && content.source_kind === "file" ? (
              content.content_type === "static_image" || content.content_type === "ad_creative" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <video src={previewUrl} className="h-full w-full object-cover" muted />
              )
            ) : (
              <span className="text-xs text-muted-foreground">No preview</span>
            )}
          </div>
          <div>
            <h1 className="font-display text-xl font-bold">{content.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">{content.platform}</Badge>
              <Badge variant="outline">{content.content_type.replace(/_/g, " ")}</Badge>
              <span className="text-xs text-muted-foreground">{formatDate(content.created_at)}</span>
            </div>
          </div>
        </div>
        <MetricsForm contentId={content.id} existing={metrics ?? null} />
      </div>

      {content.status === "failed" && (
        <EmptyState
          title="Analysis failed"
          description="Something went wrong while analyzing this content. You can try again from the content library."
        />
      )}

      {content.status === "processing" && (
        <EmptyState
          title="Still analyzing"
          description="This piece is still being processed. Refresh in a moment."
        />
      )}

      {!analysis && content.status === "uploaded" && (
        <EmptyState
          title="Not analyzed yet"
          description="This content hasn't been analyzed yet."
        />
      )}

      {analysis && (
        <>
          <Card className="p-6">
            <OverallScore
              score={analysis.overall_score}
              dataDisclaimer={
                analysis.data_completeness === "with_metrics"
                  ? "Includes real performance data you provided, alongside AI content-quality scoring."
                  : "AI content potential — no real performance metrics were provided. This estimates quality based on observable properties of the content, not measured results."
              }
            />
            {analysis.summary && (
              <p className="mt-4 border-t border-white/[0.08] pt-4 text-sm text-muted-foreground">
                {analysis.summary}
              </p>
            )}
          </Card>

          {metrics && (
            <Card className="p-6">
              <h2 className="mb-4 font-display text-lg font-semibold">Real performance data</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  ["Views", metrics.views],
                  ["Reach", metrics.reach],
                  ["Likes", metrics.likes],
                  ["Comments", metrics.comments],
                  ["Shares", metrics.shares],
                  ["Saves", metrics.saves],
                  ["Completion rate", metrics.completion_rate ? `${metrics.completion_rate}%` : null],
                  ["CTR", metrics.ctr ? `${metrics.ctr.toFixed(2)}%` : null],
                ]
                  .filter(([, v]) => v !== null && v !== undefined)
                  .map(([label, value]) => (
                    <div key={label as string}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="font-display text-lg font-semibold">{value}</p>
                    </div>
                  ))}
              </div>
            </Card>
          )}

          <section>
            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <Card className="p-5">
                <p className="mb-3 text-sm font-semibold text-score-excellent">What worked</p>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {(analysis.strengths_json as string[]).map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-score-excellent">✓</span> {s}
                    </li>
                  ))}
                </ul>
              </Card>
              <Card className="p-5">
                <p className="mb-3 text-sm font-semibold text-score-fair">What can improve</p>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {(analysis.weaknesses_json as string[]).map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-score-fair">△</span> {s}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </section>

          <Card className="p-6">
            <h2 className="mb-4 font-display text-lg font-semibold">Score breakdown</h2>
            <ScoreBreakdown scores={analysis.scores_json as Record<string, number>} />
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 font-display text-lg font-semibold">Hook analysis</h2>
            <HookAnalysis data={analysis.hook_analysis_json as never} />
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 font-display text-lg font-semibold">Retention analysis</h2>
            <RetentionAnalysis
              timeline={(analysis.retention_analysis_json as { timeline: never[] })?.timeline ?? []}
              summary={(analysis.retention_analysis_json as { summary: string })?.summary ?? ""}
              isPredicted={(analysis.retention_analysis_json as { isPredicted: boolean })?.isPredicted ?? true}
            />
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 font-display text-lg font-semibold">Content structure</h2>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {((analysis.structure_json as { detectedStructure: string[] })?.detectedStructure ?? []).map(
                (step, i, arr) => (
                  <span key={i} className="flex items-center gap-2">
                    <span className="rounded-full bg-white/[0.06] px-3 py-1">{step}</span>
                    {i < arr.length - 1 && <span className="text-muted-foreground">→</span>}
                  </span>
                )
              )}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {(analysis.structure_json as { notes: string })?.notes}
            </p>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 font-display text-lg font-semibold">Visual analysis</h2>
            <VisualAnalysis data={analysis.visual_analysis_json as never} />
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 font-display text-lg font-semibold">Recommendations</h2>
            <RecommendationsList contentId={content.id} recommendations={recommendations ?? []} />
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 font-display text-lg font-semibold">Next content</h2>
            <NextContentIdeas contentId={content.id} ideas={ideas ?? []} />
          </Card>

          <div className="text-center">
            <Link href="/compare" className="text-sm text-primary hover:underline">
              Compare this with another piece →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
