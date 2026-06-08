"use client";

import React, { useState } from "react";
import Link from "next/link";
import { DollarSign, Clock, ChevronRight } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SkillChip } from "@/components/profile/skill-chip";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import type { Project, Profile } from "@/lib/types/database.types";

interface ProjectCardProps {
  project: Project;
  freelier?: Profile;
  onApply?: (projectId: string) => Promise<void>;
  hasApplied?: boolean;
  showApply?: boolean;
}

export function ProjectCard({
  project,
  freelier,
  onApply,
  hasApplied = false,
  showApply = true,
}: ProjectCardProps) {
  const [applying, setApplying] = useState(false);

  const handleApply = async () => {
    if (!onApply) return;
    setApplying(true);
    try {
      await onApply(project.id);
    } finally {
      setApplying(false);
    }
  };

  const statusColors = {
    draft: "bg-gray-100 text-gray-600",
    open: "bg-green-100 text-green-700",
    in_progress: "bg-blue-100 text-blue-700",
    completed: "bg-gray-100 text-gray-500",
    cancelled: "bg-red-100 text-red-600",
  };

  return (
    <Card className="group flex flex-col hover:shadow-md hover:border-primary/30 transition-all duration-200">
      <CardContent className="flex-1 pt-6">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <Link
            href={`/projects/${project.id}`}
            className="flex-1 font-display text-base font-semibold text-gray-900 hover:text-primary dark:text-white dark:hover:text-primary transition-colors line-clamp-2"
          >
            {project.title}
          </Link>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColors[project.status]}`}
          >
            {project.status.replace("_", " ")}
          </span>
        </div>

        {/* Description */}
        {project.description && (
          <p className="mb-3 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {project.description}
          </p>
        )}

        {/* Budget */}
        {(project.budget_min || project.budget_max) && (
          <div className="mb-3 flex items-center gap-1 text-sm">
            <DollarSign className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-gray-900 dark:text-white">
              {project.budget_min && project.budget_max
                ? `${formatCurrency(project.budget_min)} – ${formatCurrency(project.budget_max)}`
                : project.budget_min
                ? `From ${formatCurrency(project.budget_min)}`
                : `Up to ${formatCurrency(project.budget_max!)}`}
            </span>
          </div>
        )}

        {/* Skills */}
        {project.required_skills.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {project.required_skills.slice(0, 4).map((skill) => (
              <SkillChip key={skill} skill={skill} />
            ))}
            {project.required_skills.length > 4 && (
              <span className="text-xs text-gray-400">
                +{project.required_skills.length - 4} more
              </span>
            )}
          </div>
        )}

        {/* Freelier info */}
        {freelier && (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-white text-xs font-bold">
              {(freelier.display_name ?? freelier.email)[0].toUpperCase()}
            </div>
            <span>{freelier.display_name ?? freelier.email}</span>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Clock className="h-3 w-3" />
          <span>{formatRelativeTime(project.created_at)}</span>
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/projects/${project.id}`}>
              Details <ChevronRight className="h-3 w-3" />
            </Link>
          </Button>
          {showApply && (
            <Button
              size="sm"
              onClick={handleApply}
              loading={applying}
              disabled={hasApplied || applying}
              variant={hasApplied ? "muted" : "default"}
            >
              {hasApplied ? "Applied" : "Apply"}
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
