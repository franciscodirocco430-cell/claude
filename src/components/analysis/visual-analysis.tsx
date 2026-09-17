import { Progress } from "@/components/ui/progress";
import { getScoreTier, scoreTierColorClass } from "@/lib/score";

interface VisualAnalysisData {
  applicable: boolean;
  subjectClarity?: number | null;
  contrast?: number | null;
  composition?: number | null;
  textReadability?: number | null;
  visualHierarchy?: number | null;
  branding?: number | null;
  thumbnailStrength?: number | null;
  scrollStoppingPower?: number | null;
  recommendations: string[];
}

const LABELS: Record<string, string> = {
  subjectClarity: "Subject clarity",
  contrast: "Contrast",
  composition: "Composition",
  textReadability: "Text readability",
  visualHierarchy: "Visual hierarchy",
  branding: "Branding",
  thumbnailStrength: "Thumbnail strength",
  scrollStoppingPower: "Scroll-stopping power",
};

export function VisualAnalysis({ data }: { data: VisualAnalysisData }) {
  if (!data.applicable) {
    return (
      <p className="text-sm text-muted-foreground">
        No image or video frame was available to analyze visually for this piece.
      </p>
    );
  }

  const metrics = Object.entries(LABELS)
    .map(([key, label]) => ({ key, label, value: (data as unknown as Record<string, unknown>)[key] as number | null | undefined }))
    .filter((m) => typeof m.value === "number");

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {metrics.map((m) => {
          const tier = getScoreTier(m.value as number);
          return (
            <div key={m.key} className="flex items-center gap-3">
              <span className="w-36 shrink-0 text-sm">{m.label}</span>
              <Progress value={m.value as number} className="flex-1" />
              <span className={`w-8 text-right text-sm font-semibold ${scoreTierColorClass[tier]}`}>
                {Math.round(m.value as number)}
              </span>
            </div>
          );
        })}
      </div>
      {data.recommendations.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold">Recommendations</p>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {data.recommendations.map((rec, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary">•</span> {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
