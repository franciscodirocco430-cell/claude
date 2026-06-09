import type { SubscriptionTier } from "@/lib/types/database.types";

export const SUBSCRIPTION_LIMITS: Record<
  SubscriptionTier,
  {
    monthly_matches: number;
    active_proposals: number;
    algorithm_precision: "basic" | "advanced" | "ai";
    badges_visible: boolean;
    boost_feed: boolean;
    featured_feed: boolean;
    ai_autopilot_access: boolean;
    price_monthly: number;
    maxApplications: number;
    maxProjects: number;
    canViewProposals: boolean;
    canUseChat: boolean;
    priorityMatching: boolean;
  }
> = {
  free: {
    monthly_matches: 3,
    active_proposals: 1,
    algorithm_precision: "basic",
    badges_visible: false,
    boost_feed: false,
    featured_feed: false,
    ai_autopilot_access: false,
    price_monthly: 0,
    maxApplications: 3,
    maxProjects: 1,
    canViewProposals: true,
    canUseChat: true,
    priorityMatching: false,
  },
  pro: {
    monthly_matches: Infinity,
    active_proposals: 5,
    algorithm_precision: "advanced",
    badges_visible: true,
    boost_feed: true,
    featured_feed: false,
    ai_autopilot_access: false,
    price_monthly: 19,
    maxApplications: Infinity,
    maxProjects: Infinity,
    canViewProposals: true,
    canUseChat: true,
    priorityMatching: true,
  },
  elite: {
    monthly_matches: Infinity,
    active_proposals: Infinity,
    algorithm_precision: "ai",
    badges_visible: true,
    boost_feed: true,
    featured_feed: true,
    ai_autopilot_access: true,
    price_monthly: 49,
    maxApplications: Infinity,
    maxProjects: Infinity,
    canViewProposals: true,
    canUseChat: true,
    priorityMatching: true,
  },
};

export const XP_EVENTS = {
  CONTRACT_COMPLETED: 50,
  ON_TIME_DELIVERY: 20,
  FIVE_STAR_REVIEW: 30,
  FOUR_STAR_REVIEW: 15,
  PROFILE_COMPLETE: 10,
  FIRST_CONTRACT: 25,
  FAST_RESPONSE: 5,
  LATE_DELIVERY: -10,
  CONTRACT_CANCELLED: -15,
  MODERATION_STRIKE: -20,
} as const;

export const XP_LEVELS = {
  junior: { min: 0, max: 200, label: "Junior" },
  mid: { min: 201, max: 500, label: "Mid" },
  senior: { min: 501, max: 800, label: "Senior" },
  elite: { min: 801, max: 1000, label: "Elite" },
} as const;

export function getXPLevel(score: number): keyof typeof XP_LEVELS {
  if (score >= 801) return "elite";
  if (score >= 501) return "senior";
  if (score >= 201) return "mid";
  return "junior";
}

export const XP_THRESHOLDS = {
  BRONZE: 0,
  SILVER: 200,
  GOLD: 500,
  PLATINUM: 800,
  ELITE: 1000,
} as const;

export const TIER_LABELS: Record<SubscriptionTier, string> = {
  free: "Free",
  pro: "Pro",
  elite: "Elite",
};

export const BADGE_DEFINITIONS = [
  {
    id: "top_freelo",
    label: "Top Freelo",
    icon: "⭐",
    description: "Ranked in the top 10% of freelancers",
    requiredXP: 500,
  },
  {
    id: "verified_pro",
    label: "Verified Pro",
    icon: "✓",
    description: "Professional identity verified",
    requiredTier: "pro" as SubscriptionTier,
  },
  {
    id: "fast_responder",
    label: "Fast Responder",
    icon: "⚡",
    description: "Responds to messages within 1 hour",
    requiredXP: 100,
  },
  {
    id: "elite_member",
    label: "Elite Member",
    icon: "👑",
    description: "Elite tier subscriber",
    requiredTier: "elite" as SubscriptionTier,
  },
  {
    id: "first_contract",
    label: "First Contract",
    icon: "🤝",
    description: "Completed your first contract",
    requiredXP: 50,
  },
  {
    id: "rising_star",
    label: "Rising Star",
    icon: "🌟",
    description: "Earned 200+ XP",
    requiredXP: 200,
  },
] as const;

export const PLATFORM_FEE_RATE = 0.01; // 1%

export const AVAILABILITY_LABELS = {
  available: "Available",
  busy: "Busy",
  open_to_offers: "Open to Offers",
} as const;

export const AVAILABILITY_COLORS = {
  available: "text-green-500",
  busy: "text-red-500",
  open_to_offers: "text-yellow-500",
} as const;
