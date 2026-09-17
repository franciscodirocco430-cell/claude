import Link from "next/link";
import { FileText, ImageIcon, Video, Layers } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { getScoreTier, scoreTierColorClass } from "@/lib/score";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/lib/types/database.types";

type ContentItem = Database["public"]["Tables"]["content_items"]["Row"];

const TYPE_ICON: Record<string, typeof Video> = {
  reel: Video,
  tiktok: Video,
  youtube_short: Video,
  long_form_video: Video,
  carousel: Layers,
  static_image: ImageIcon,
  ad_creative: ImageIcon,
  written_post: FileText,
  script: FileText,
  other: FileText,
};

export function ContentCard({
  item,
  score,
  thumbnailUrl,
}: {
  item: ContentItem;
  score: number | null;
  thumbnailUrl: string | null;
}) {
  const Icon = TYPE_ICON[item.content_type] ?? FileText;
  const tier = score !== null ? getScoreTier(score) : null;

  return (
    <Link
      href={`/content/${item.id}`}
      className="group flex flex-col overflow-hidden rounded-card border border-white/[0.08] bg-surface-card transition-colors hover:border-white/20"
    >
      <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-white/[0.03]">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <Icon className="h-8 w-8 text-muted-foreground/40" />
        )}
        {tier && (
          <span
            className={`absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-semibold ${scoreTierColorClass[tier]}`}
          >
            {Math.round(score!)}
          </span>
        )}
        {item.status === "processing" && (
          <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-xs text-muted-foreground">
            Processing
          </span>
        )}
        {item.status === "failed" && (
          <span className="absolute left-2 top-2 rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-300">
            Failed
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="line-clamp-1 text-sm font-medium">{item.title}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="text-[11px]">
            {item.platform}
          </Badge>
          <Badge variant="outline" className="text-[11px]">
            {item.content_type.replace(/_/g, " ")}
          </Badge>
        </div>
        <p className="mt-auto text-xs text-muted-foreground">
          {formatRelativeTime(item.created_at)}
        </p>
      </div>
    </Link>
  );
}
