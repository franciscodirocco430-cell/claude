import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface DashboardRecommendation {
  id: string;
  contentId: string;
  title: string;
  priority: string;
}

const PRIORITY_VARIANT: Record<string, "destructive" | "warning" | "outline"> = {
  high: "destructive",
  medium: "warning",
  low: "outline",
};

export function RecommendationWidget({ items }: { items: DashboardRecommendation[] }) {
  return (
    <Card className="h-full p-5">
      <p className="mb-4 font-display text-base font-semibold">Top recommendations</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recommendations yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((rec) => (
            <li key={rec.id}>
              <Link
                href={`/content/${rec.contentId}`}
                className="flex items-start justify-between gap-2 rounded-lg px-2 py-1.5 -mx-2 hover:bg-white/[0.04]"
              >
                <span className="text-sm">{rec.title}</span>
                <Badge variant={PRIORITY_VARIANT[rec.priority] ?? "outline"} className="shrink-0">
                  {rec.priority}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
