import { Badge } from "@/components/ui/badge";
import type { CampaignStatus } from "@/server/campaigns/service";
import type { Channel } from "@/server/compliance/channels";
import { CHANNEL_LABELS } from "@/server/prospects/profile-url";

const STATUS: Record<
  CampaignStatus,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  active: { label: "Activa", variant: "default" },
  draft: { label: "Borrador", variant: "outline" },
  paused: { label: "Pausada", variant: "secondary" },
  archived: { label: "Archivada", variant: "secondary" },
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const s = STATUS[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function ChannelBadges({ channels }: { channels: readonly Channel[] }) {
  if (channels.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {channels.map((c) => (
        <Badge key={c} variant="outline">
          {CHANNEL_LABELS[c]}
        </Badge>
      ))}
    </div>
  );
}
