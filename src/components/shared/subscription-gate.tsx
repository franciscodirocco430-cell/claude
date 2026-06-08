import React from "react";
import Link from "next/link";
import { Lock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SubscriptionTier } from "@/lib/types/database.types";
import { TIER_LABELS } from "@/lib/constants";

interface SubscriptionGateProps {
  requiredTier: "pro" | "elite";
  currentTier: SubscriptionTier;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const tierLevel: Record<SubscriptionTier, number> = {
  free: 0,
  pro: 1,
  elite: 2,
};

export function SubscriptionGate({
  requiredTier,
  currentTier,
  children,
  fallback,
}: SubscriptionGateProps) {
  const hasAccess = tierLevel[currentTier] >= tierLevel[requiredTier];

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
        <Lock className="h-6 w-6 text-primary" />
      </div>
      <div>
        <h3 className="font-display text-lg font-semibold text-gray-900 dark:text-white">
          {TIER_LABELS[requiredTier]} Feature
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Upgrade to {TIER_LABELS[requiredTier]} to unlock this feature.
        </p>
      </div>
      <Button size="sm" asChild>
        <Link href="/settings">
          <Zap className="h-4 w-4" />
          Upgrade to {TIER_LABELS[requiredTier]}
        </Link>
      </Button>
    </div>
  );
}
