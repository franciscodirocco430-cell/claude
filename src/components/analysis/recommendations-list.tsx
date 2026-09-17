"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import type { Database } from "@/lib/types/database.types";

type Recommendation = Database["public"]["Tables"]["recommendations"]["Row"];

const PRIORITY_VARIANT: Record<string, "destructive" | "warning" | "outline"> = {
  high: "destructive",
  medium: "warning",
  low: "outline",
};

export function RecommendationsList({
  contentId,
  recommendations,
}: {
  contentId: string;
  recommendations: Recommendation[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);

  const handleRegenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/content/${contentId}/recommendations`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to generate recommendations");
      }
      toast({ type: "success", title: "Recommendations updated" });
      router.refresh();
    } catch (err) {
      toast({
        type: "error",
        title: "Could not generate recommendations",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Concrete, evidence-based actions — not generic advice.
        </p>
        <LiquidButton
          size="default"
          icon={<Sparkles className="h-4 w-4" />}
          loading={loading}
          onClick={handleRegenerate}
        >
          Generate Recommendations
        </LiquidButton>
      </div>

      {recommendations.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No recommendations yet.
        </p>
      ) : (
        <div className="space-y-4">
          {[...recommendations]
            .sort((a, b) => {
              const order = { high: 0, medium: 1, low: 2 };
              return (order[a.priority as keyof typeof order] ?? 3) - (order[b.priority as keyof typeof order] ?? 3);
            })
            .map((rec) => (
              <Card key={rec.id} className="p-5">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <h3 className="font-display text-base font-semibold">{rec.title}</h3>
                  <Badge variant={PRIORITY_VARIANT[rec.priority] ?? "outline"}>
                    {rec.priority}
                  </Badge>
                </div>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-xs font-semibold uppercase text-muted-foreground">Why it matters</dt>
                    <dd className="text-muted-foreground">{rec.why_it_matters}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase text-muted-foreground">Evidence</dt>
                    <dd className="text-muted-foreground">{rec.evidence}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase text-muted-foreground">Recommended action</dt>
                    <dd>{rec.recommended_action}</dd>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                    <span>Improves: {rec.expected_improvement_area}</span>
                  </div>
                  {rec.suggested_rewrite && (
                    <div className="rounded-lg bg-white/[0.04] p-3">
                      <dt className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Suggested rewrite</dt>
                      <dd className="italic">&ldquo;{rec.suggested_rewrite}&rdquo;</dd>
                    </div>
                  )}
                </dl>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
