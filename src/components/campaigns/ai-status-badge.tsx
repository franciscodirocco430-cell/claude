import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { prospects } from "@/db/schema";

export type AiStatus = (typeof prospects.$inferSelect)["aiStatus"];

const LABELS: Record<AiStatus, string> = {
  idle: "Sin preparar",
  queued: "En cola",
  researching: "Investigando",
  drafting: "Redactando",
  ready: "Mensajes listos",
  error: "Error de IA",
};

export const BUSY_STATUSES: readonly AiStatus[] = ["queued", "researching", "drafting"];

export function AiStatusBadge({ status }: { status: AiStatus }) {
  const busy = BUSY_STATUSES.includes(status);
  return (
    <Badge
      variant={status === "ready" ? "default" : status === "error" ? "destructive" : "outline"}
      aria-live={busy ? "polite" : undefined}
    >
      {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {LABELS[status]}
    </Badge>
  );
}
