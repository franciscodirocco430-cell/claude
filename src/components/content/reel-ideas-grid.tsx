"use client";

import * as React from "react";
import { Wand2, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { useToast } from "@/components/ui/toast";
import type { ContentIdea } from "@/lib/ai/schemas";

export function ReelIdeasGrid() {
  const { toast } = useToast();
  const [niche, setNiche] = React.useState("");
  const [targetAudience, setTargetAudience] = React.useState("");
  const [contentTone, setContentTone] = React.useState("");
  const [contentGoals, setContentGoals] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [ideas, setIdeas] = React.useState<ContentIdea[]>([]);

  const handleGenerate = async () => {
    if (!niche.trim()) {
      toast({ type: "error", title: "Add your niche first" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/reel-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, targetAudience, contentTone, contentGoals }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to generate reel ideas");
      }
      const data = await res.json();
      setIdeas(data.ideas);
      toast({ type: "success", title: "New reel ideas ready" });
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

  return (
    <div className="space-y-8">
      <Card className="space-y-4 p-6">
        <h2 className="font-display text-lg font-semibold">Your creator profile</h2>
        <p className="text-sm text-muted-foreground">
          Nothing here is saved — fill it in each time, or keep this tab open while you work.
        </p>
        <Input
          label="Niche"
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          placeholder="e.g. personal finance for freelancers"
        />
        <Textarea
          label="Target audience (optional)"
          value={targetAudience}
          onChange={(e) => setTargetAudience(e.target.value)}
          placeholder="Who are you creating for?"
        />
        <Input
          label="Tone (optional)"
          value={contentTone}
          onChange={(e) => setContentTone(e.target.value)}
          placeholder="e.g. direct, playful, authoritative"
        />
        <Textarea
          label="Goals (optional)"
          value={contentGoals}
          onChange={(e) => setContentGoals(e.target.value)}
          placeholder="What are you trying to achieve with your content?"
        />
        <LiquidButton icon={<Wand2 className="h-4 w-4" />} loading={loading} onClick={handleGenerate}>
          Generate Reel Ideas
        </LiquidButton>
      </Card>

      {ideas.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ideas.map((idea, i) => (
            <Card key={i} className="flex flex-col gap-3 p-5">
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
              {idea.suggestedStructure.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {idea.suggestedStructure.map((step, j, arr) => (
                    <React.Fragment key={j}>
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5">{step}</span>
                      {j < arr.length - 1 && <ArrowRight className="h-3 w-3" />}
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
    </div>
  );
}
