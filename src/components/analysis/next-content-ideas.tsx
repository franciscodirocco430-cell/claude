"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Wand2, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { useToast } from "@/components/ui/toast";
import type { Database } from "@/lib/types/database.types";

type ContentIdea = Database["public"]["Tables"]["content_ideas"]["Row"];

export function NextContentIdeas({
  contentId,
  ideas,
}: {
  contentId: string;
  ideas: ContentIdea[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/content/${contentId}/ideas`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to generate ideas");
      }
      toast({ type: "success", title: "New ideas generated" });
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Create your next post from this analysis.</p>
        <LiquidButton size="default" icon={<Wand2 className="h-4 w-4" />} loading={loading} onClick={handleGenerate}>
          Create Next Content
        </LiquidButton>
      </div>

      {ideas.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No content ideas yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {ideas.map((idea) => (
            <Card key={idea.id} className="flex flex-col gap-3 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                {idea.format}
              </p>
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
    </div>
  );
}
