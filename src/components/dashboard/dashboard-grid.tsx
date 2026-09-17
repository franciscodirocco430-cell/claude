"use client";

import * as React from "react";
import { Layers, Trophy, Zap, TrendingUp, MousePointerClick } from "lucide-react";
import { DraggableWidgetGrid, type WidgetDefinition } from "@/components/ui/draggable-widget-grid";
import { MetricWidget } from "./metric-widget";
import { RecentContentWidget, type RecentEntry } from "./recent-content-widget";
import { RecommendationWidget, type DashboardRecommendation } from "./recommendation-widget";
import { ContentOpportunitiesWidget, type OpportunityEntry } from "./content-opportunities-widget";
import { ScoreHistoryChart, type ScorePoint } from "@/components/charts/score-history-chart";
import { FormatDistributionChart, type FormatCount } from "@/components/charts/format-distribution-chart";
import { getScoreTier, scoreTierColorClass } from "@/lib/score";
import { Card } from "@/components/ui/card";

export interface DashboardData {
  overallScore: number | null;
  scoreChange: number | null;
  totalAnalyzed: number;
  countsByType: Record<string, number>;
  bestFormat: { format: string; avgScore: number } | null;
  avgHook: number | null;
  avgRetention: number | null;
  avgCta: number | null;
  topContent: RecentEntry[];
  recentContent: RecentEntry[];
  recommendations: DashboardRecommendation[];
  opportunities: OpportunityEntry[];
  formatDistribution: FormatCount[];
  scoreEvolution: ScorePoint[];
}

const DEFAULT_ORDER = [
  "overall-score",
  "content-analyzed",
  "best-format",
  "hook-performance",
  "retention-potential",
  "cta-effectiveness",
  "top-content",
  "recent-analysis",
  "recommendations",
  "content-opportunities",
  "format-distribution",
  "score-evolution",
];

export function DashboardGrid({
  data,
  initialLayout,
}: {
  data: DashboardData;
  initialLayout: string[] | null;
}) {
  const [order, setOrder] = React.useState<string[]>(
    initialLayout && initialLayout.length === DEFAULT_ORDER.length ? initialLayout : DEFAULT_ORDER
  );

  const persist = React.useCallback((next: string[]) => {
    setOrder(next);
    fetch("/api/dashboard/layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layout: next }),
    }).catch(() => {});
  }, []);

  const scoreTier = data.overallScore !== null ? getScoreTier(data.overallScore) : null;

  const widgets: WidgetDefinition[] = [
    {
      id: "overall-score",
      label: "Overall content score",
      span: "md",
      content: (
        <Card className="flex h-full flex-col justify-between p-5">
          <p className="text-sm text-muted-foreground">Overall content score</p>
          <div>
            <p className={`font-display text-4xl font-bold ${scoreTier ? scoreTierColorClass[scoreTier] : ""}`}>
              {data.overallScore !== null ? Math.round(data.overallScore) : "—"}
              <span className="text-lg text-muted-foreground"> / 100</span>
            </p>
            {data.scoreChange !== null && (
              <p
                className={`mt-2 text-xs font-medium ${
                  data.scoreChange >= 0 ? "text-score-excellent" : "text-score-poor"
                }`}
              >
                {data.scoreChange >= 0 ? "↑" : "↓"} {Math.abs(Math.round(data.scoreChange))} vs previous period
              </p>
            )}
          </div>
        </Card>
      ),
    },
    {
      id: "content-analyzed",
      label: "Content analyzed",
      span: "sm",
      content: (
        <MetricWidget
          label="Content analyzed"
          value={String(data.totalAnalyzed)}
          icon={Layers}
          subtext={Object.entries(data.countsByType)
            .map(([type, count]) => `${count} ${type.replace(/_/g, " ")}`)
            .join(" · ")}
        />
      ),
    },
    {
      id: "best-format",
      label: "Best performing format",
      span: "sm",
      content: (
        <MetricWidget
          label="Best performing format"
          value={data.bestFormat ? data.bestFormat.format.replace(/_/g, " ") : "—"}
          icon={Trophy}
          subtext={data.bestFormat ? `${Math.round(data.bestFormat.avgScore)} average score` : "Not enough data"}
        />
      ),
    },
    {
      id: "hook-performance",
      label: "Hook performance",
      span: "sm",
      content: (
        <MetricWidget
          label="Hook performance"
          value={data.avgHook !== null ? String(Math.round(data.avgHook)) : "—"}
          icon={Zap}
          subtext="Average hook score"
        />
      ),
    },
    {
      id: "retention-potential",
      label: "Retention potential",
      span: "sm",
      content: (
        <MetricWidget
          label="Retention potential"
          value={data.avgRetention !== null ? String(Math.round(data.avgRetention)) : "—"}
          icon={TrendingUp}
          subtext="AI-estimated average"
        />
      ),
    },
    {
      id: "cta-effectiveness",
      label: "CTA effectiveness",
      span: "sm",
      content: (
        <MetricWidget
          label="CTA effectiveness"
          value={data.avgCta !== null ? String(Math.round(data.avgCta)) : "—"}
          icon={MousePointerClick}
          subtext="Average across analyzed content"
        />
      ),
    },
    {
      id: "top-content",
      label: "Top content",
      span: "md",
      content: <RecentContentWidget title="Top content" items={data.topContent} />,
    },
    {
      id: "recent-analysis",
      label: "Recent analysis",
      span: "md",
      content: <RecentContentWidget title="Recent analysis" items={data.recentContent} />,
    },
    {
      id: "recommendations",
      label: "Recommendations",
      span: "md",
      content: <RecommendationWidget items={data.recommendations} />,
    },
    {
      id: "content-opportunities",
      label: "Content opportunities",
      span: "md",
      content: <ContentOpportunitiesWidget items={data.opportunities} />,
    },
    {
      id: "format-distribution",
      label: "Format distribution",
      span: "lg",
      content: <FormatDistributionChart data={data.formatDistribution} />,
    },
    {
      id: "score-evolution",
      label: "Score evolution",
      span: "lg",
      content: <ScoreHistoryChart data={data.scoreEvolution} />,
    },
  ];

  return <DraggableWidgetGrid widgets={widgets} order={order} onOrderChange={persist} />;
}

export { DEFAULT_ORDER };
