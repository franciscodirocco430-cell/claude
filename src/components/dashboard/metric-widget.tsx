import { type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricWidget({
  label,
  value,
  subtext,
  icon: Icon,
  trend,
  accentClass,
}: {
  label: string;
  value: string;
  subtext?: string;
  icon?: LucideIcon;
  trend?: { direction: "up" | "down" | "flat"; label: string };
  accentClass?: string;
}) {
  return (
    <Card className="flex h-full flex-col justify-between p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="mt-3">
        <p className={cn("font-display text-3xl font-bold", accentClass)}>{value}</p>
        {subtext && <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>}
        {trend && (
          <p
            className={cn(
              "mt-2 text-xs font-medium",
              trend.direction === "up" && "text-score-excellent",
              trend.direction === "down" && "text-score-poor",
              trend.direction === "flat" && "text-muted-foreground"
            )}
          >
            {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"} {trend.label}
          </p>
        )}
      </div>
    </Card>
  );
}
