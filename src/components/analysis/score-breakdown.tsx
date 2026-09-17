"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { getScoreTier, scoreTierColorClass } from "@/lib/score";
import { cn } from "@/lib/utils";

const SCORE_LABELS: Record<string, string> = {
  hook: "Hook",
  clarity: "Clarity",
  structure: "Structure",
  visualQuality: "Visual quality",
  storytelling: "Storytelling",
  engagementPotential: "Engagement potential",
  retentionPotential: "Retention potential",
  cta: "CTA",
  originality: "Originality",
  brandConsistency: "Brand consistency",
};

const SCORE_EXPLANATIONS: Record<string, string> = {
  hook: "How strongly the opening seconds or first line create tension, curiosity, or immediate relevance.",
  clarity: "How easy it is to understand the core message without re-reading or re-watching.",
  structure: "Whether the piece follows a coherent narrative arc appropriate for its format.",
  visualQuality: "Composition, contrast, and readability of the visual elements present.",
  storytelling: "Use of narrative techniques — tension, stakes, resolution — to hold attention.",
  engagementPotential: "Likelihood the content invites reactions, comments, or shares based on its construction.",
  retentionPotential: "Estimated ability to keep the audience watching or reading to the end.",
  cta: "Clarity, timing, and persuasiveness of the call to action.",
  originality: "How distinct the angle or execution is versus common patterns in this format.",
  brandConsistency: "Alignment with a coherent voice and visual identity across the piece.",
};

export function ScoreBreakdown({ scores }: { scores: Record<string, number> }) {
  const [expanded, setExpanded] = React.useState<string | null>(null);

  return (
    <div className="space-y-1">
      {Object.entries(scores).map(([key, value]) => {
        const tier = getScoreTier(value);
        const isOpen = expanded === key;
        return (
          <div key={key} className="border-b border-white/[0.06] py-3 last:border-0">
            <button
              className="flex w-full items-center gap-4 text-left"
              onClick={() => setExpanded(isOpen ? null : key)}
              aria-expanded={isOpen}
            >
              <span className="w-40 shrink-0 text-sm font-medium">
                {SCORE_LABELS[key] ?? key}
              </span>
              <Progress value={value} className="flex-1" variant="gradient" />
              <span className={cn("w-10 shrink-0 text-right text-sm font-semibold", scoreTierColorClass[tier])}>
                {Math.round(value)}
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  isOpen && "rotate-180"
                )}
              />
            </button>
            {isOpen && (
              <div className="mt-2 rounded-lg bg-white/[0.03] p-3 text-xs text-muted-foreground">
                <p className="mb-1 font-medium text-foreground">Why this score</p>
                {SCORE_EXPLANATIONS[key] ?? "No explanation available for this metric."}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
