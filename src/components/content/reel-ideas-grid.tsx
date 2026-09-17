"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wand2, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/shared/empty-state";
import type { Database } from "@/lib/types/database.types";

type ProfileReelIdea = Database["public"]["Tables"]["profile_reel_ideas"]["Row"];

export function ReelIdeasGrid({
  hasNiche,
  ideas,
}: {
  hasNiche: boolean;
  ideas: ProfileReelIdea[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile/reel-ideas", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to generate reel ideas");
      }
      toast({ type: "success", title: "New reel ideas ready" });
      router.refresh();
    } catch (err) {
      toast({
        type: "error",
        title: "Could not generate ideas",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  if (!hasNiche) {
    return (
      <EmptyState
        title="Set up your creator profile first"
        description="Add your niche, audience, tone and goals in Settings so we can generate reel ideas tailored to you."
        ctaHref="/settings"
        ctaLabel="Go to Settings"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <LiquidButton icon={<Wand2 className="h-4 w-4" />} loading={loading} onClick={handleGenerate}>
          Generate Reel Ideas
        </LiquidButton>
      </div>

      {ideas.length === 0 ? (
        <EmptyState
          title="No reel ideas yet"
          description="Generate a batch of reel ideas based on your creator profile."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ideas.map((idea) => (
            <Card key={idea.id} className="flex flex-col gap-3 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">{idea.format}</p>
              <h3 className="font-display text-base font-semibold">{idea.title}</h3>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Hook: </span>
                {idea.hook}
              </p>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Angle: </span>
                {idea.angle}
              </p>
              {Array.isArray(idea.suggested_structure_json) && idea.suggested_structure_json.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {(idea.suggested_structure_json as string[]).map((step, i, arr) => (
                    <React.Fragment key={i}>
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5">{step}</span>
                      {i < arr.length - 1 && <ArrowRight className="h-3 w-3" />}
                    </React.Fragment>
                  ))}
                </div>
              )}
              <p className="mt-auto text-sm">
                <span className="font-medium">CTA: </span>
                {idea.cta}
              </p>
            </Card>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Want ideas from a specific piece instead?{" "}
        <Link href="/content" className="text-primary hover:underline">
          Analyze it first
        </Link>
        .
      </p>
    </div>
  );
}
