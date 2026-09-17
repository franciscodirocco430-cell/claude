import { Quote, Lightbulb } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getScoreTier, scoreTierColorClass } from "@/lib/score";

interface HookAnalysisData {
  originalHook: string;
  score: number;
  whyItWorks: string[];
  whatCouldImprove: string[];
  alternatives: { label: string; text: string }[];
}

export function HookAnalysis({ data }: { data: HookAnalysisData }) {
  const tier = getScoreTier(data.score);

  return (
    <div className="space-y-6">
      <div className="rounded-card border border-white/[0.08] bg-surface-card p-5">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Quote className="h-3.5 w-3.5" /> Original hook
        </div>
        <p className="text-sm italic text-foreground">&ldquo;{data.originalHook}&rdquo;</p>
      </div>

      <div className="flex items-center gap-3">
        <span className={`font-display text-3xl font-bold ${scoreTierColorClass[tier]}`}>
          {Math.round(data.score)}
        </span>
        <span className="text-sm text-muted-foreground">/ 100 hook score</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-semibold text-score-excellent">Why it works</p>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {data.whyItWorks.map((point, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-score-excellent">+</span> {point}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-score-fair">What could improve</p>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {data.whatCouldImprove.map((point, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-score-fair">−</span> {point}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Lightbulb className="h-4 w-4 text-primary" /> Better hook alternatives
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {data.alternatives.map((alt) => (
            <Card key={alt.label} className="p-4">
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                {alt.label}
              </p>
              <p className="text-sm">{alt.text}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
