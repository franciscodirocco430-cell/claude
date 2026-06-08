import React from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { XPBar } from "./xp-bar";
import { BadgeDisplay } from "./badge-display";
import { SkillChip } from "./skill-chip";
import { Progress } from "@/components/ui/progress";
import type { Profile, FreeloProfile } from "@/lib/types/database.types";
import type { Badge as BadgeType } from "@/lib/xp";
import { AVAILABILITY_LABELS, AVAILABILITY_COLORS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

type CellVariant =
  | "bio"
  | "skills"
  | "portfolio"
  | "xp"
  | "badges"
  | "stats"
  | "availability";

interface BentoCellProps {
  variant: CellVariant;
  profile?: Profile;
  freeloProfile?: FreeloProfile;
  badges?: BadgeType[];
  "data-col-span"?: string;
  "data-row-span"?: string;
  className?: string;
}

const cellBaseClasses =
  "rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 overflow-hidden";

export function BentoCell({
  variant,
  profile,
  freeloProfile,
  badges = [],
  className,
  ...dataProps
}: BentoCellProps) {
  const cellProps = {
    className: cn(cellBaseClasses, className),
    ...dataProps,
  };

  switch (variant) {
    case "bio":
      return (
        <div {...cellProps}>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">
            About
          </h3>
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {freeloProfile?.bio || "No bio provided yet."}
          </p>
          {freeloProfile?.hourly_rate && (
            <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1">
              <span className="text-xs font-semibold text-primary">
                {formatCurrency(freeloProfile.hourly_rate)}/hr
              </span>
            </div>
          )}
        </div>
      );

    case "skills":
      return (
        <div {...cellProps}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
            Skills
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {(freeloProfile?.skills ?? []).length > 0 ? (
              (freeloProfile?.skills ?? []).map((skill) => (
                <SkillChip key={skill} skill={skill} />
              ))
            ) : (
              <p className="text-sm text-gray-500">No skills listed.</p>
            )}
          </div>
          {(freeloProfile?.stack ?? []).length > 0 && (
            <>
              <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-widest text-secondary">
                Stack
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {(freeloProfile?.stack ?? []).map((item) => (
                  <SkillChip key={item} skill={item} variant="secondary" />
                ))}
              </div>
            </>
          )}
        </div>
      );

    case "portfolio":
      return (
        <div {...cellProps}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
            Portfolio
          </h3>
          <div className="space-y-3">
            {(freeloProfile?.portfolio_items ?? []).length > 0 ? (
              (freeloProfile?.portfolio_items ?? []).map((item, i) => (
                <a
                  key={i}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-xl border border-gray-200 p-3 transition-colors hover:border-primary/50 hover:bg-primary/5 dark:border-gray-700 dark:hover:border-primary/50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {item.title}
                    </p>
                    {item.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                    )}
                  </div>
                  <ExternalLink className="h-4 w-4 shrink-0 text-gray-400" />
                </a>
              ))
            ) : (
              <p className="text-sm text-gray-500">No portfolio items yet.</p>
            )}
          </div>
        </div>
      );

    case "xp":
      return (
        <div {...cellProps}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
            XP & Level
          </h3>
          {profile && <XPBar xpScore={profile.xp_score} />}
        </div>
      );

    case "badges":
      return (
        <div {...cellProps}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
            Badges
          </h3>
          <BadgeDisplay badges={badges} />
        </div>
      );

    case "stats":
      return (
        <div {...cellProps}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
            Profile
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Member since</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      year: "numeric",
                    })
                  : "-"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Tier</span>
              <Badge variant={profile?.subscription_tier as "free" | "pro" | "elite"}>
                {profile?.subscription_tier?.toUpperCase()}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">XP Score</span>
              <span className="font-bold text-primary">{profile?.xp_score ?? 0}</span>
            </div>
          </div>
        </div>
      );

    case "availability": {
      const avail = freeloProfile?.availability ?? "available";
      return (
        <div {...cellProps}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
            Availability
          </h3>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                avail === "available" && "bg-green-500",
                avail === "busy" && "bg-red-500",
                avail === "open_to_offers" && "bg-yellow-500"
              )}
            />
            <span className={cn("text-sm font-semibold", AVAILABILITY_COLORS[avail])}>
              {AVAILABILITY_LABELS[avail]}
            </span>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {avail === "available" && "Ready to take on new projects right away"}
            {avail === "busy" && "Currently at capacity, check back soon"}
            {avail === "open_to_offers" && "Accepting interesting opportunities"}
          </p>
        </div>
      );
    }

    default:
      return null;
  }
}
