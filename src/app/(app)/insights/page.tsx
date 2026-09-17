import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata = { title: "Insights" };

const MIN_SAMPLE_SIZE = 5;

export default async function InsightsPage() {
  const supabase = createClient();

  const { data: items } = await supabase.from("content_items").select("*");
  const { data: analyses } = await supabase
    .from("content_analysis")
    .select("*")
    .in("content_id", (items ?? []).map((i) => i.id));

  if (!items || !analyses || analyses.length === 0) {
    return (
      <EmptyState
        title="No insights yet"
        description="More content is needed to identify reliable patterns. Analyze a few pieces first."
        ctaHref="/content/new"
        ctaLabel="Analyze content"
      />
    );
  }

  const itemById = new Map(items.map((i) => [i.id, i]));

  type Group = { label: string; scores: number[] };
  const byFormat = new Map<string, Group>();
  const byPlatform = new Map<string, Group>();

  for (const analysis of analyses) {
    const item = itemById.get(analysis.content_id);
    if (!item) continue;

    const pushTo = (map: Map<string, Group>, key: string) => {
      const g = map.get(key) ?? { label: key, scores: [] };
      g.scores.push(analysis.overall_score);
      map.set(key, g);
    };

    pushTo(byFormat, item.content_type);
    pushTo(byPlatform, item.platform);
  }

  const avg = (nums: number[]) => nums.reduce((a, b) => a + b, 0) / nums.length;

  const reliableFormats = Array.from(byFormat.values())
    .filter((g) => g.scores.length >= MIN_SAMPLE_SIZE)
    .sort((a, b) => avg(b.scores) - avg(a.scores));

  const reliablePlatforms = Array.from(byPlatform.values())
    .filter((g) => g.scores.length >= MIN_SAMPLE_SIZE)
    .sort((a, b) => avg(b.scores) - avg(a.scores));

  const durations = analyses
    .map((a) => {
      const item = itemById.get(a.content_id);
      return item?.duration_seconds
        ? { duration: item.duration_seconds, score: (a.scores_json as Record<string, number>)?.retentionPotential }
        : null;
    })
    .filter((d): d is { duration: number; score: number } => Boolean(d && typeof d.score === "number"));

  const hasEnoughData = analyses.length >= MIN_SAMPLE_SIZE;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Insights</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Patterns detected across your own uploaded content — never invented, always sample-sized.
        </p>
      </div>

      {!hasEnoughData && (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">
            More content is needed to identify reliable patterns. You have {analyses.length} analyzed
            piece{analyses.length === 1 ? "" : "s"} — patterns become available once each group has at
            least {MIN_SAMPLE_SIZE}.
          </p>
        </Card>
      )}

      {reliableFormats.length > 0 && (
        <Card className="p-6">
          <h2 className="mb-3 font-display text-lg font-semibold">Format performance</h2>
          <ul className="space-y-2 text-sm">
            {reliableFormats.map((g) => (
              <li key={g.label} className="flex items-center justify-between">
                <span className="capitalize text-muted-foreground">{g.label.replace(/_/g, " ")}</span>
                <span>
                  {Math.round(avg(g.scores))} avg ·{" "}
                  <span className="text-xs text-muted-foreground">based on {g.scores.length} pieces</span>
                </span>
              </li>
            ))}
          </ul>
          {reliableFormats.length >= 2 && (
            <p className="mt-4 text-sm text-muted-foreground">
              {reliableFormats[0].label.replace(/_/g, " ")} content outperforms{" "}
              {reliableFormats[reliableFormats.length - 1].label.replace(/_/g, " ")} in your uploaded
              dataset (based on {reliableFormats[0].scores.length} vs{" "}
              {reliableFormats[reliableFormats.length - 1].scores.length} pieces).
            </p>
          )}
        </Card>
      )}

      {reliablePlatforms.length > 0 && (
        <Card className="p-6">
          <h2 className="mb-3 font-display text-lg font-semibold">Platform performance</h2>
          <ul className="space-y-2 text-sm">
            {reliablePlatforms.map((g) => (
              <li key={g.label} className="flex items-center justify-between">
                <span className="capitalize text-muted-foreground">{g.label}</span>
                <span>
                  {Math.round(avg(g.scores))} avg ·{" "}
                  <span className="text-xs text-muted-foreground">based on {g.scores.length} pieces</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {durations.length >= MIN_SAMPLE_SIZE && (
        <Card className="p-6">
          <h2 className="mb-3 font-display text-lg font-semibold">Duration vs. retention potential</h2>
          <p className="text-sm text-muted-foreground">
            Based on {durations.length} pieces with duration data, here is the estimated retention
            potential by length bucket. These are AI estimates, not measured watch-time.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {["0-15s", "15-40s", "40-90s", "90s+"].map((bucket, i) => {
              const [min, max] = [
                [0, 15],
                [15, 40],
                [40, 90],
                [90, Infinity],
              ][i];
              const bucketed = durations.filter((d) => d.duration >= min && d.duration < max);
              if (bucketed.length === 0) return null;
              return (
                <li key={bucket} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{bucket}</span>
                  <span>
                    {Math.round(avg(bucketed.map((d) => d.score)))} avg ·{" "}
                    <span className="text-xs text-muted-foreground">{bucketed.length} pieces</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {reliableFormats.length === 0 && reliablePlatforms.length === 0 && hasEnoughData && (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">
            You have {analyses.length} analyzed pieces, but no single format or platform has reached the
            {` ${MIN_SAMPLE_SIZE}`}-piece threshold yet for a reliable pattern. Keep analyzing similar
            content types to unlock this.
          </p>
        </Card>
      )}
    </div>
  );
}
