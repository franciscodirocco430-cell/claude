import React from "react";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { Milestone } from "@/lib/types/database.types";

interface MilestoneListProps {
  milestones: Milestone[];
  onMarkComplete?: (index: number) => void;
  readonly?: boolean;
}

const statusConfig = {
  pending: {
    icon: Circle,
    label: "Pending",
    color: "text-gray-400",
    bg: "bg-gray-50 dark:bg-gray-800",
  },
  in_progress: {
    icon: Clock,
    label: "In Progress",
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-900/20",
  },
  completed: {
    icon: CheckCircle2,
    label: "Completed",
    color: "text-green-500",
    bg: "bg-green-50 dark:bg-green-900/20",
  },
};

export function MilestoneList({
  milestones,
  onMarkComplete,
  readonly = false,
}: MilestoneListProps) {
  if (milestones.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">No milestones defined.</p>
    );
  }

  const totalAmount = milestones.reduce((sum, m) => sum + m.amount, 0);
  const completedAmount = milestones
    .filter((m) => m.status === "completed")
    .reduce((sum, m) => sum + m.amount, 0);

  return (
    <div className="space-y-3">
      {milestones.map((milestone, index) => {
        const config = statusConfig[milestone.status];
        const StatusIcon = config.icon;

        return (
          <div
            key={index}
            className={cn(
              "flex items-start gap-3 rounded-xl p-3 transition-colors",
              config.bg
            )}
          >
            <StatusIcon className={cn("mt-0.5 h-4 w-4 shrink-0", config.color)} />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p
                  className={cn(
                    "text-sm font-medium",
                    milestone.status === "completed"
                      ? "text-gray-500 line-through dark:text-gray-400"
                      : "text-gray-900 dark:text-white"
                  )}
                >
                  {milestone.title}
                </p>
                <span className="shrink-0 text-sm font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(milestone.amount)}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span>Due {formatDate(milestone.due_date)}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 font-medium",
                    config.color
                  )}
                >
                  {config.label}
                </span>
              </div>
            </div>
            {!readonly && onMarkComplete && milestone.status !== "completed" && (
              <button
                onClick={() => onMarkComplete(index)}
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
              >
                Mark Done
              </button>
            )}
          </div>
        );
      })}

      {/* Progress summary */}
      {milestones.length > 1 && (
        <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Progress</span>
            <span>
              {formatCurrency(completedAmount)} / {formatCurrency(totalAmount)}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
              style={{
                width: totalAmount > 0 ? `${(completedAmount / totalAmount) * 100}%` : "0%",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
