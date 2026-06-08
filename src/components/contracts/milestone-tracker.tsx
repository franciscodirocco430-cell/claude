"use client";

import React, { useState } from "react";
import { CheckCircle2, Clock, Circle, AlertCircle } from "lucide-react";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { Milestone } from "@/lib/types/database.types";

interface MilestoneTrackerProps {
  milestones: Milestone[];
  contractId: string;
  canMarkComplete?: boolean;
  onMilestoneUpdated?: (updatedMilestones: Milestone[]) => void;
}

export function MilestoneTracker({
  milestones,
  contractId,
  canMarkComplete = false,
  onMilestoneUpdated,
}: MilestoneTrackerProps) {
  const [localMilestones, setLocalMilestones] = useState<Milestone[]>(milestones);
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);
  const { toast } = useToast();

  const completedCount = localMilestones.filter((m) => m.status === "completed").length;
  const totalAmount = localMilestones.reduce((sum, m) => sum + m.amount, 0);
  const completedAmount = localMilestones
    .filter((m) => m.status === "completed")
    .reduce((sum, m) => sum + m.amount, 0);

  const handleMarkComplete = async (index: number) => {
    setLoadingIndex(index);
    try {
      const updated = localMilestones.map((m, i) =>
        i === index ? { ...m, status: "completed" as const } : m
      );
      setLocalMilestones(updated);
      onMilestoneUpdated?.(updated);
      toast({
        type: "success",
        title: "Milestone completed!",
        description: `"${localMilestones[index].title}" marked as done.`,
      });
    } catch {
      toast({ type: "error", title: "Failed to update milestone" });
    } finally {
      setLoadingIndex(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {completedCount} / {localMilestones.length} milestones complete
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {formatCurrency(completedAmount)} of {formatCurrency(totalAmount)} earned
          </p>
        </div>
        <span className="text-lg font-bold text-primary">
          {localMilestones.length > 0
            ? Math.round((completedCount / localMilestones.length) * 100)
            : 0}%
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
          style={{
            width: localMilestones.length > 0
              ? `${(completedCount / localMilestones.length) * 100}%`
              : "0%",
          }}
        />
      </div>

      {/* Milestone list */}
      <div className="space-y-3">
        {localMilestones.map((milestone, index) => {
          const isPast = new Date(milestone.due_date) < new Date();
          const isOverdue = isPast && milestone.status !== "completed";

          return (
            <div
              key={index}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-4 transition-all",
                milestone.status === "completed"
                  ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                  : isOverdue
                  ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                  : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
              )}
            >
              {/* Status icon */}
              <div className="mt-0.5 shrink-0">
                {milestone.status === "completed" ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : isOverdue ? (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                ) : milestone.status === "in_progress" ? (
                  <Clock className="h-5 w-5 text-blue-500" />
                ) : (
                  <Circle className="h-5 w-5 text-gray-400" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      milestone.status === "completed"
                        ? "text-gray-500 line-through dark:text-gray-400"
                        : "text-gray-900 dark:text-white"
                    )}
                  >
                    {milestone.title}
                  </p>
                  <span className="shrink-0 text-sm font-bold text-gray-900 dark:text-white">
                    {formatCurrency(milestone.amount)}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <span
                    className={cn(
                      isOverdue && milestone.status !== "completed"
                        ? "text-red-500 font-medium"
                        : "text-gray-500 dark:text-gray-400"
                    )}
                  >
                    Due {formatDate(milestone.due_date)}
                    {isOverdue && milestone.status !== "completed" && " (overdue)"}
                  </span>
                </div>
              </div>

              {/* Mark complete button */}
              {canMarkComplete && milestone.status !== "completed" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleMarkComplete(index)}
                  loading={loadingIndex === index}
                  className="shrink-0 text-xs text-primary hover:bg-primary/10"
                >
                  Mark Done
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
