import React from "react";
import { cn } from "@/lib/utils";

interface SkillChipProps {
  skill: string;
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
}

export function SkillChip({ skill, variant = "primary", size = "sm" }: SkillChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium transition-colors",
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm",
        variant === "primary"
          ? "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
          : "bg-secondary/10 text-secondary border border-secondary/20 hover:bg-secondary/20"
      )}
    >
      {skill}
    </span>
  );
}
