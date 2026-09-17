"use client";

import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import type { Database } from "@/lib/types/database.types";

type Recommendation = Database["public"]["Tables"]["recommendations"]["Row"];

const PRIORITY_VARIANT: Record<string, "destructive" | "warning" | "outline"> = {
  high: "destructive",
  medium: "warning",
  low: "outline",
};

export function RecommendationsFeed({
  recommendations,
  titleByContentId,
}: {
  recommendations: Recommendation[];
  titleByContentId: Record<string, string>;
}) {
  const [priority, setPriority] = React.useState("");

  const filtered = priority
    ? recommendations.filter((r) => r.priority === priority)
    : recommendations;

  return (
    <div className="space-y-4">
      <Select
        value={priority}
        onChange={setPriority}
        placeholder="All priorities"
        options={[
          { value: "high", label: "High" },
          { value: "medium", label: "Medium" },
          { value: "low", label: "Low" },
        ]}
        className="w-48"
      />

      <div className="space-y-4">
        {filtered.map((rec) => (
          <Card key={rec.id} className="p-5">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <Link
                  href={`/content/${rec.content_id}`}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {titleByContentId[rec.content_id] ?? "View content"}
                </Link>
                <h3 className="font-display text-base font-semibold">{rec.title}</h3>
              </div>
              <Badge variant={PRIORITY_VARIANT[rec.priority] ?? "outline"}>{rec.priority}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{rec.why_it_matters}</p>
            <p className="mt-2 text-sm">
              <span className="font-medium">Action: </span>
              {rec.recommended_action}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
