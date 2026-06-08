import { XP_THRESHOLDS, BADGE_DEFINITIONS } from "@/lib/constants";
import type { Profile, FreeloProfile, SubscriptionTier } from "@/lib/types/database.types";

export type XPTier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Elite";

export const XP_AWARD_AMOUNTS = {
  CONTRACT_COMPLETED: 100,
  REVIEW_RECEIVED_5_STAR: 50,
  REVIEW_RECEIVED_4_STAR: 25,
  REVIEW_RECEIVED_3_STAR: 10,
  REVIEW_RECEIVED_BELOW_3: 0,
  FIRST_CONTRACT: 50,
  PROFILE_COMPLETED: 25,
  FAST_RESPONSE: 10,
} as const;

export function getXPTier(score: number): XPTier {
  if (score >= XP_THRESHOLDS.ELITE) return "Elite";
  if (score >= XP_THRESHOLDS.PLATINUM) return "Platinum";
  if (score >= XP_THRESHOLDS.GOLD) return "Gold";
  if (score >= XP_THRESHOLDS.SILVER) return "Silver";
  return "Bronze";
}

export function getNextTierThreshold(score: number): number {
  if (score >= XP_THRESHOLDS.ELITE) return XP_THRESHOLDS.ELITE;
  if (score >= XP_THRESHOLDS.PLATINUM) return XP_THRESHOLDS.ELITE;
  if (score >= XP_THRESHOLDS.GOLD) return XP_THRESHOLDS.PLATINUM;
  if (score >= XP_THRESHOLDS.SILVER) return XP_THRESHOLDS.GOLD;
  return XP_THRESHOLDS.SILVER;
}

export function getCurrentTierThreshold(score: number): number {
  if (score >= XP_THRESHOLDS.ELITE) return XP_THRESHOLDS.ELITE;
  if (score >= XP_THRESHOLDS.PLATINUM) return XP_THRESHOLDS.PLATINUM;
  if (score >= XP_THRESHOLDS.GOLD) return XP_THRESHOLDS.GOLD;
  if (score >= XP_THRESHOLDS.SILVER) return XP_THRESHOLDS.SILVER;
  return XP_THRESHOLDS.BRONZE;
}

export function getXPProgress(score: number): number {
  const current = getCurrentTierThreshold(score);
  const next = getNextTierThreshold(score);
  if (current === next) return 100;
  return Math.min(100, Math.round(((score - current) / (next - current)) * 100));
}

export interface Badge {
  id: string;
  label: string;
  icon: string;
  description: string;
}

export function getBadges(
  profile: Pick<Profile, "xp_score" | "subscription_tier">
): Badge[] {
  const earned: Badge[] = [];

  for (const badge of BADGE_DEFINITIONS) {
    if ("requiredXP" in badge && profile.xp_score >= badge.requiredXP) {
      earned.push({
        id: badge.id,
        label: badge.label,
        icon: badge.icon,
        description: badge.description,
      });
    } else if (
      "requiredTier" in badge &&
      tierLevel(profile.subscription_tier) >= tierLevel(badge.requiredTier)
    ) {
      earned.push({
        id: badge.id,
        label: badge.label,
        icon: badge.icon,
        description: badge.description,
      });
    }
  }

  return earned;
}

function tierLevel(tier: SubscriptionTier): number {
  const levels: Record<SubscriptionTier, number> = { free: 0, pro: 1, elite: 2 };
  return levels[tier];
}

export function calculateXPFromReview(rating: number): number {
  if (rating === 5) return XP_AWARD_AMOUNTS.REVIEW_RECEIVED_5_STAR;
  if (rating === 4) return XP_AWARD_AMOUNTS.REVIEW_RECEIVED_4_STAR;
  if (rating === 3) return XP_AWARD_AMOUNTS.REVIEW_RECEIVED_3_STAR;
  return XP_AWARD_AMOUNTS.REVIEW_RECEIVED_BELOW_3;
}
