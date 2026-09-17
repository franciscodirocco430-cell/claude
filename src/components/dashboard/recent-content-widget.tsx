import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getScoreTier, scoreTierColorClass } from "@/lib/score";
import { formatRelativeTime } from "@/lib/utils";

export interface RecentEntry {
  id: string;
  title: string;
  platform: string;
  score: number | null;
  createdAt: string;
}

export function RecentContentWidget({ title, items }: { title: string; items: RecentEntry[] }) {
  return (
    <Card className="h-full p-5">
      <p className="mb-4 font-display text-base font-semibold">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing here yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const tier = item.score !== null ? getScoreTier(item.score) : null;
            return (
              <li key={item.id}>
                <Link
                  href={`/content/${item.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 -mx-2 hover:bg-white/[0.04]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.platform} · {formatRelativeTime(item.createdAt)}
                    </p>
                  </div>
                  {tier && (
                    <span className={`shrink-0 text-sm font-semibold ${scoreTierColorClass[tier]}`}>
                      {Math.round(item.score!)}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
