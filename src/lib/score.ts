export type ScoreTier = "excellent" | "good" | "fair" | "poor";

export function getScoreTier(score: number): ScoreTier {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "fair";
  return "poor";
}

export const scoreTierLabel: Record<ScoreTier, string> = {
  excellent: "Excellent",
  good: "Strong potential",
  fair: "Needs work",
  poor: "Weak",
};

export const scoreTierColorClass: Record<ScoreTier, string> = {
  excellent: "text-score-excellent",
  good: "text-score-good",
  fair: "text-score-fair",
  poor: "text-score-poor",
};

export const scoreTierBgClass: Record<ScoreTier, string> = {
  excellent: "bg-score-excellent",
  good: "bg-score-good",
  fair: "bg-score-fair",
  poor: "bg-score-poor",
};

export function formatScoreLabel(score: number): string {
  return `${Math.round(score)} / 100`;
}
