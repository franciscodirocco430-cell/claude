"use client";

import * as React from "react";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Database } from "@/lib/types/database.types";

type ContentItem = Database["public"]["Tables"]["content_items"]["Row"];
type ContentAnalysis = Database["public"]["Tables"]["content_analysis"]["Row"];
type ContentMetrics = Database["public"]["Tables"]["content_metrics"]["Row"];

const SCORE_KEYS = [
  ["hook", "Hook"],
  ["clarity", "Clarity"],
  ["structure", "Structure"],
  ["visualQuality", "Visual"],
  ["storytelling", "Storytelling"],
  ["retentionPotential", "Retention"],
  ["cta", "CTA"],
] as const;

function buildFactors(
  a: { item: ContentItem; analysis: ContentAnalysis; metrics?: ContentMetrics },
  b: { item: ContentItem; analysis: ContentAnalysis; metrics?: ContentMetrics }
): string[] {
  const factors: string[] = [];
  const scoresA = a.analysis.scores_json as Record<string, number>;
  const scoresB = b.analysis.scores_json as Record<string, number>;

  for (const [key, label] of SCORE_KEYS) {
    const diff = (scoresA[key] ?? 0) - (scoresB[key] ?? 0);
    if (Math.abs(diff) >= 15) {
      const winner = diff > 0 ? a.item.title : b.item.title;
      factors.push(
        `${winner} scores notably higher on ${label.toLowerCase()} (${Math.round(
          Math.abs(diff)
        )} points). Possible contributing factor.`
      );
    }
  }

  if (a.metrics && b.metrics) {
    const engagementA = (a.metrics.likes ?? 0) + (a.metrics.comments ?? 0) + (a.metrics.shares ?? 0);
    const engagementB = (b.metrics.likes ?? 0) + (b.metrics.comments ?? 0) + (b.metrics.shares ?? 0);
    if (engagementA !== engagementB && (a.metrics.views || b.metrics.views)) {
      const winner = engagementA > engagementB ? a.item.title : b.item.title;
      factors.push(
        `${winner} shows higher real engagement (likes + comments + shares). This difference may be associated with the score gaps above, but other factors (timing, audience, distribution) could also play a role.`
      );
    }
  }

  return factors;
}

export function CompareView({
  items,
  analyses,
  metrics,
}: {
  items: ContentItem[];
  analyses: ContentAnalysis[];
  metrics: ContentMetrics[];
}) {
  const [idA, setIdA] = React.useState(items[0]?.id ?? "");
  const [idB, setIdB] = React.useState(items[1]?.id ?? "");

  const findAnalysis = (id: string) =>
    analyses.filter((a) => a.content_id === id).sort((x, y) => y.created_at.localeCompare(x.created_at))[0];
  const findMetrics = (id: string) => metrics.find((m) => m.content_id === id);

  const itemA = items.find((i) => i.id === idA);
  const itemB = items.find((i) => i.id === idB);
  const analysisA = itemA ? findAnalysis(itemA.id) : undefined;
  const analysisB = itemB ? findAnalysis(itemB.id) : undefined;

  const factors =
    itemA && itemB && analysisA && analysisB
      ? buildFactors(
          { item: itemA, analysis: analysisA, metrics: findMetrics(itemA.id) },
          { item: itemB, analysis: analysisB, metrics: findMetrics(itemB.id) }
        )
      : [];

  const options = items.map((i) => ({ value: i.id, label: i.title }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Content A" value={idA} onChange={setIdA} options={options} />
        <Select label="Content B" value={idB} onChange={setIdB} options={options} />
      </div>

      {analysisA && analysisB ? (
        <>
          <Card className="p-6">
            <div className="grid grid-cols-3 items-center gap-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground">{itemA?.title}</p>
                <p className="font-display text-3xl font-bold">{Math.round(analysisA.overall_score)}</p>
              </div>
              <p className="text-sm text-muted-foreground">vs</p>
              <div>
                <p className="text-sm text-muted-foreground">{itemB?.title}</p>
                <p className="font-display text-3xl font-bold">{Math.round(analysisB.overall_score)}</p>
              </div>
            </div>
          </Card>

          <Card className="space-y-4 p-6">
            {SCORE_KEYS.map(([key, label]) => {
              const a = (analysisA.scores_json as Record<string, number>)[key] ?? 0;
              const b = (analysisB.scores_json as Record<string, number>)[key] ?? 0;
              return (
                <div key={key} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <Progress value={a} className="justify-self-end" />
                  <span className="w-24 text-center text-xs text-muted-foreground">{label}</span>
                  <Progress value={b} />
                </div>
              );
            })}
          </Card>

          {factors.length > 0 && (
            <Card className="p-6">
              <h2 className="mb-3 font-display text-lg font-semibold">
                Why one likely worked better
              </h2>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {factors.map((f, i) => (
                  <li key={i}>• {f}</li>
                ))}
              </ul>
            </Card>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Select two analyzed pieces to compare.</p>
      )}
    </div>
  );
}
