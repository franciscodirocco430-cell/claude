import type { SubscriptionTier } from "@/lib/types/database.types";

export const SUBSCRIPTION_LIMITS: Record<
  SubscriptionTier,
  {
    maxApplications: number;
    maxProjects: number;
    canViewProposals: boolean;
    canUseChat: boolean;
    priorityMatching: boolean;
  }
> = {
  free: {
    maxApplications: 3,
    maxProjects: 1,
    canViewProposals: true,
    canUseChat: true,
    priorityMatching: false,
  },
  pro: {
    maxApplications: 20,
    maxProjects: 10,
    canViewProposals: true,
    canUseChat: true,
    priorityMatching: true,
  },
  elite: {
    maxApplications: Infinity,
    maxProjects: Infinity,
    canViewProposals: true,
    canUseChat: true,
    priorityMatching: true,
  },
};

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
