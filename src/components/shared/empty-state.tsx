import React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  cta?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, cta }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800">
        <Icon className="h-8 w-8 text-gray-400 dark:text-gray-500" />
      </div>
      <div>
        <h3 className="font-display text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
        {description && (
          <p className="mt-1 max-w-xs text-sm text-gray-500 dark:text-gray-400">{description}</p>
        )}
      </div>
      {cta && (
        cta.href ? (
          <Button size="sm" asChild>
            <Link href={cta.href}>{cta.label}</Link>
          </Button>
        ) : (
          <Button size="sm" onClick={cta.onClick}>
            {cta.label}
          </Button>
        )
      )}
    </div>
  );
}
