import { cn } from "@/lib/utils";

interface TimelinePoint {
  timestampLabel: string;
  section: string;
  risk: "strong" | "neutral" | "drop_risk";
  note: string;
}

const RISK_STYLES: Record<TimelinePoint["risk"], string> = {
  strong: "bg-score-excellent",
  neutral: "bg-score-fair",
  drop_risk: "bg-score-poor",
};

const RISK_LABEL: Record<TimelinePoint["risk"], string> = {
  strong: "Strong",
  neutral: "Neutral",
  drop_risk: "Drop-risk",
};

export function RetentionAnalysis({
  timeline,
  summary,
  isPredicted,
}: {
  timeline: TimelinePoint[];
  summary: string;
  isPredicted: boolean;
}) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {isPredicted
          ? "Predicted retention risk — no real watch-time data was provided. This estimate is based on pacing and structure only."
          : summary}
      </p>

      <div className="relative space-y-4 pl-4">
        <div className="absolute bottom-0 left-[7px] top-2 w-px bg-white/[0.08]" />
        {timeline.map((point, i) => (
          <div key={i} className="relative flex gap-4">
            <span
              className={cn(
                "absolute -left-4 top-1 h-3.5 w-3.5 rounded-full border-2 border-background",
                RISK_STYLES[point.risk]
              )}
            />
            <div className="flex-1 rounded-xl border border-white/[0.08] bg-surface-card p-4">
              <div className="mb-1 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">
                  {point.timestampLabel} · {point.section}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium text-background",
                    RISK_STYLES[point.risk]
                  )}
                >
                  {RISK_LABEL[point.risk]}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{point.note}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">{summary}</p>
    </div>
  );
}
