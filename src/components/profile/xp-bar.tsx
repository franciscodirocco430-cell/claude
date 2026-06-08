import React from "react";
import { Progress } from "@/components/ui/progress";
import { getXPTier, getNextTierThreshold, getCurrentTierThreshold, getXPProgress } from "@/lib/xp";

interface XPBarProps {
  xpScore: number;
  showDetails?: boolean;
}

const tierColors: Record<string, string> = {
  Bronze: "text-amber-600",
  Silver: "text-gray-500",
  Gold: "text-yellow-500",
  Platinum: "text-cyan-500",
  Elite: "text-primary",
};

export function XPBar({ xpScore, showDetails = true }: XPBarProps) {
  const tier = getXPTier(xpScore);
  const next = getNextTierThreshold(xpScore);
  const current = getCurrentTierThreshold(xpScore);
  const progress = getXPProgress(xpScore);
  const isMaxTier = tier === "Elite" && xpScore >= next;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className={`text-lg font-bold font-display ${tierColors[tier]}`}>
            {tier}
          </span>
          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">Tier</span>
        </div>
        <div className="text-right">
          <span className="text-xl font-bold text-primary">{xpScore}</span>
          <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">XP</span>
        </div>
      </div>

      <Progress value={progress} variant="gradient" className="h-2.5" />

      {showDetails && !isMaxTier && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {xpScore - current} / {next - current} XP to next tier
        </p>
      )}
      {isMaxTier && (
        <p className="text-xs font-medium text-primary">
          Maximum tier achieved!
        </p>
      )}
    </div>
  );
}
