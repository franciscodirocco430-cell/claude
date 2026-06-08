import { describe, it, expect } from "vitest";
import { getXPTier, getNextTierThreshold, getXPProgress, getBadges } from "./xp";
import { XP_THRESHOLDS } from "./constants";

describe("getXPTier", () => {
  // Bronze tier (0-199)
  it("returns Bronze at 0 XP", () => {
    expect(getXPTier(0)).toBe("Bronze");
  });

  it("returns Bronze at 1 XP", () => {
    expect(getXPTier(1)).toBe("Bronze");
  });

  it("returns Bronze at 199 XP", () => {
    expect(getXPTier(199)).toBe("Bronze");
  });

  // Silver tier (200-499)
  it("returns Silver at exactly 200 XP", () => {
    expect(getXPTier(200)).toBe("Silver");
  });

  it("returns Silver at 201 XP", () => {
    expect(getXPTier(201)).toBe("Silver");
  });

  it("returns Silver at 499 XP", () => {
    expect(getXPTier(499)).toBe("Silver");
  });

  // Gold tier (500-799)
  it("returns Gold at exactly 500 XP", () => {
    expect(getXPTier(500)).toBe("Gold");
  });

  it("returns Gold at 501 XP", () => {
    expect(getXPTier(501)).toBe("Gold");
  });

  it("returns Gold at 799 XP", () => {
    expect(getXPTier(799)).toBe("Gold");
  });

  // Platinum tier (800-999)
  it("returns Platinum at exactly 800 XP", () => {
    expect(getXPTier(800)).toBe("Platinum");
  });

  it("returns Platinum at 801 XP", () => {
    expect(getXPTier(801)).toBe("Platinum");
  });

  it("returns Platinum at 999 XP", () => {
    expect(getXPTier(999)).toBe("Platinum");
  });

  // Elite tier (1000+)
  it("returns Elite at exactly 1000 XP", () => {
    expect(getXPTier(1000)).toBe("Elite");
  });

  it("returns Elite above 1000 XP", () => {
    expect(getXPTier(1500)).toBe("Elite");
  });

  it("returns Elite at very high XP", () => {
    expect(getXPTier(9999)).toBe("Elite");
  });
});

describe("getNextTierThreshold", () => {
  it("returns Silver threshold for Bronze", () => {
    expect(getNextTierThreshold(0)).toBe(XP_THRESHOLDS.SILVER);
    expect(getNextTierThreshold(0)).toBe(200);
  });

  it("returns Gold threshold for Silver", () => {
    expect(getNextTierThreshold(200)).toBe(XP_THRESHOLDS.GOLD);
    expect(getNextTierThreshold(200)).toBe(500);
  });

  it("returns Platinum threshold for Gold", () => {
    expect(getNextTierThreshold(500)).toBe(XP_THRESHOLDS.PLATINUM);
    expect(getNextTierThreshold(500)).toBe(800);
  });

  it("returns Elite threshold for Platinum", () => {
    expect(getNextTierThreshold(800)).toBe(XP_THRESHOLDS.ELITE);
    expect(getNextTierThreshold(800)).toBe(1000);
  });

  it("returns Elite threshold for Elite (already max)", () => {
    expect(getNextTierThreshold(1000)).toBe(XP_THRESHOLDS.ELITE);
    expect(getNextTierThreshold(1000)).toBe(1000);
  });
});

describe("getXPProgress", () => {
  it("returns 0% at 0 XP (start of Bronze)", () => {
    expect(getXPProgress(0)).toBe(0);
  });

  it("returns 50% halfway through Bronze tier", () => {
    // Bronze: 0-200, halfway = 100
    expect(getXPProgress(100)).toBe(50);
  });

  it("returns correct percent for Silver tier", () => {
    // Silver: 200-500, at 350 = 50%
    expect(getXPProgress(350)).toBe(50);
  });

  it("returns 100% at Elite max", () => {
    expect(getXPProgress(1000)).toBe(100);
  });

  it("returns 100% above Elite max", () => {
    expect(getXPProgress(2000)).toBe(100);
  });
});

describe("getBadges", () => {
  it("returns no badges for new user", () => {
    const badges = getBadges({ xp_score: 0, subscription_tier: "free" });
    expect(badges).toHaveLength(0);
  });

  it("returns Fast Responder badge at 100 XP", () => {
    const badges = getBadges({ xp_score: 100, subscription_tier: "free" });
    const hasFastResponder = badges.some((b) => b.id === "fast_responder");
    expect(hasFastResponder).toBe(true);
  });

  it("returns Rising Star badge at 200 XP", () => {
    const badges = getBadges({ xp_score: 200, subscription_tier: "free" });
    const hasRisingStar = badges.some((b) => b.id === "rising_star");
    expect(hasRisingStar).toBe(true);
  });

  it("returns Top Freelo badge at 500 XP", () => {
    const badges = getBadges({ xp_score: 500, subscription_tier: "free" });
    const hasTopFreelo = badges.some((b) => b.id === "top_freelo");
    expect(hasTopFreelo).toBe(true);
  });

  it("returns Verified Pro badge for pro tier", () => {
    const badges = getBadges({ xp_score: 0, subscription_tier: "pro" });
    const hasVerifiedPro = badges.some((b) => b.id === "verified_pro");
    expect(hasVerifiedPro).toBe(true);
  });

  it("returns Elite Member badge for elite tier", () => {
    const badges = getBadges({ xp_score: 0, subscription_tier: "elite" });
    const hasEliteMember = badges.some((b) => b.id === "elite_member");
    expect(hasEliteMember).toBe(true);
  });

  it("returns multiple badges for high XP elite user", () => {
    const badges = getBadges({ xp_score: 1000, subscription_tier: "elite" });
    expect(badges.length).toBeGreaterThan(3);
  });
});
