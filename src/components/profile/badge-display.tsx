import React from "react";
import type { Badge } from "@/lib/xp";

interface BadgeDisplayProps {
  badges: Badge[];
}

export function BadgeDisplay({ badges }: BadgeDisplayProps) {
  if (badges.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No badges yet. Complete contracts and earn XP to unlock badges!
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((badge) => (
        <div
          key={badge.id}
          title={badge.description}
          className="group relative flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition-all hover:bg-primary/10 cursor-default"
        >
          <span>{badge.icon}</span>
          <span>{badge.label}</span>
          {/* Tooltip */}
          <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity dark:bg-gray-700">
            {badge.description}
          </div>
        </div>
      ))}
    </div>
  );
}
