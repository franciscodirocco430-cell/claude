import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";

export interface OpportunityEntry {
  id: string;
  contentId: string;
  title: string;
  format: string;
}

export function ContentOpportunitiesWidget({ items }: { items: OpportunityEntry[] }) {
  return (
    <Card className="h-full p-5">
      <div className="mb-4 flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-primary" />
        <p className="font-display text-base font-semibold">Content opportunities</p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Analyze content to unlock next-content ideas here.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((idea) => (
            <li key={idea.id}>
              <Link
                href={`/content/${idea.contentId}`}
                className="block rounded-lg px-2 py-1.5 -mx-2 hover:bg-white/[0.04]"
              >
                <p className="text-sm font-medium">{idea.title}</p>
                <p className="text-xs text-muted-foreground">{idea.format}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
