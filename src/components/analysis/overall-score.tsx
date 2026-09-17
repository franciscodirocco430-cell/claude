import { getScoreTier, scoreTierColorClass, scoreTierLabel } from "@/lib/score";

export function OverallScore({
  score,
  dataDisclaimer,
}: {
  score: number;
  dataDisclaimer: string;
}) {
  const tier = getScoreTier(score);
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-8">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            className={scoreTierColorClass[tier]}
            stroke="currentColor"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-3xl font-bold">{Math.round(score)}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center gap-2 sm:items-start">
        <p className="font-display text-lg font-semibold">CONTENT SCORE</p>
        <p className={`text-sm font-medium ${scoreTierColorClass[tier]}`}>
          {scoreTierLabel[tier]}
        </p>
        <p className="max-w-md text-center text-xs text-muted-foreground sm:text-left">
          {dataDisclaimer}
        </p>
      </div>
    </div>
  );
}
