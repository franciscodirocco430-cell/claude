import React from "react";
import Link from "next/link";
import { DollarSign, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SkillChip } from "@/components/profile/skill-chip";
import { formatCurrency } from "@/lib/utils";
import { TIER_LABELS, AVAILABILITY_COLORS, AVAILABILITY_LABELS } from "@/lib/constants";
import type { Profile, FreeloProfile } from "@/lib/types/database.types";

interface FreeloCardProps {
  profile: Profile;
  freeloProfile: FreeloProfile;
  onInvite?: (profileId: string) => void;
}

export function FreeloCard({ profile, freeloProfile, onInvite }: FreeloCardProps) {
  const topSkills = freeloProfile.skills.slice(0, 3);
  const avail = freeloProfile.availability;

  return (
    <Card className="flex flex-col hover:shadow-md hover:border-primary/30 transition-all duration-200">
      <CardContent className="pt-6">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <Avatar size="md">
            <AvatarImage src={profile.avatar_url} alt={profile.display_name ?? ""} size="md" />
            <AvatarFallback name={profile.display_name} />
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/profile/${profile.id}`}
                className="font-display text-sm font-semibold text-gray-900 hover:text-primary dark:text-white truncate"
              >
                {profile.display_name ?? "Anonymous"}
              </Link>
              <Badge variant={profile.subscription_tier as "free" | "pro" | "elite"} className="text-xs shrink-0">
                {TIER_LABELS[profile.subscription_tier]}
              </Badge>
            </div>
            <div className="mt-0.5 flex items-center gap-1">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  avail === "available"
                    ? "bg-green-500"
                    : avail === "busy"
                    ? "bg-red-500"
                    : "bg-yellow-500"
                }`}
              />
              <span className={`text-xs ${AVAILABILITY_COLORS[avail]}`}>
                {AVAILABILITY_LABELS[avail]}
              </span>
            </div>
          </div>
        </div>

        {/* Hourly rate */}
        {freeloProfile.hourly_rate && (
          <div className="mb-3 flex items-center gap-1 text-sm">
            <DollarSign className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-gray-900 dark:text-white">
              {formatCurrency(freeloProfile.hourly_rate)}/hr
            </span>
          </div>
        )}

        {/* Top skills */}
        {topSkills.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {topSkills.map((skill) => (
              <SkillChip key={skill} skill={skill} />
            ))}
            {freeloProfile.skills.length > 3 && (
              <span className="text-xs text-gray-400 self-center">
                +{freeloProfile.skills.length - 3}
              </span>
            )}
          </div>
        )}

        {/* XP */}
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <Zap className="h-3 w-3 text-primary" />
          <span>{profile.xp_score} XP</span>
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          <Button variant="outline" size="sm" asChild className="flex-1">
            <Link href={`/profile/${profile.id}`}>View Profile</Link>
          </Button>
          {onInvite && (
            <Button
              size="sm"
              className="flex-1"
              onClick={() => onInvite(profile.id)}
              disabled={avail === "busy"}
            >
              Invite
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
