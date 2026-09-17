"use client";

import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProcessingStepStatus = "pending" | "active" | "done" | "error";

export interface ProcessingStep {
  key: string;
  label: string;
  status: ProcessingStepStatus;
}

export function AnalysisProgress({ steps }: { steps: ProcessingStep[] }) {
  return (
    <div className="mx-auto max-w-md py-16">
      <div className="mb-8 text-center">
        <h2 className="font-display text-2xl font-bold">Analyzing your content</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This runs through several real steps — some finish instantly, others
          take a moment depending on content length.
        </p>
      </div>

      <ul className="space-y-3">
        {steps.map((step) => (
          <li
            key={step.key}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors",
              step.status === "done" && "border-white/[0.08] bg-surface-card text-foreground",
              step.status === "active" && "border-primary/40 bg-primary/5 text-foreground",
              step.status === "pending" && "border-white/[0.06] text-muted-foreground",
              step.status === "error" && "border-red-500/40 bg-red-500/5 text-red-300"
            )}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
              {step.status === "done" && <Check className="h-4 w-4 text-score-excellent" />}
              {step.status === "active" && (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              )}
              {step.status === "pending" && (
                <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
              )}
              {step.status === "error" && <span className="text-red-400">!</span>}
            </span>
            {step.label}
          </li>
        ))}
      </ul>

      <div className="mt-8 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full w-1/3 animate-shimmer rounded-full bg-gradient-to-r from-transparent via-primary to-transparent bg-[length:200%_100%]" />
      </div>
    </div>
  );
}
