/**
 * Seeds realistic demo content for local development so the app doesn't
 * look empty. Demo rows are flagged `is_demo = true` and are owned by a
 * dedicated demo user — they are never mixed into a real user's data and
 * are safe to delete at any time.
 *
 * Usage: npm run seed:demo
 * Requires SUPABASE_SERVICE_ROLE_KEY (bypasses RLS intentionally, admin-only).
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEMO_EMAIL = process.env.DEMO_USER_EMAIL || "demo@contentintelligence.app";
const DEMO_PASSWORD = "demo-content-intelligence-2024";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const DEMO_ITEMS = [
  {
    title: "5 mistakes killing your onboarding flow",
    content_type: "reel",
    platform: "instagram",
    goal: "education",
    overall_score: 87,
    scores: { hook: 92, clarity: 88, structure: 85, visualQuality: 80, storytelling: 84, engagementPotential: 89, retentionPotential: 82, cta: 74, originality: 79, brandConsistency: 86 },
  },
  {
    title: "Why your pricing page is losing sales",
    content_type: "youtube_short",
    platform: "youtube",
    goal: "leads",
    overall_score: 74,
    scores: { hook: 70, clarity: 78, structure: 75, visualQuality: 72, storytelling: 68, engagementPotential: 71, retentionPotential: 69, cta: 80, originality: 65, brandConsistency: 77 },
  },
  {
    title: "Behind the scenes: building our roadmap",
    content_type: "long_form_video",
    platform: "youtube",
    goal: "authority",
    overall_score: 68,
    scores: { hook: 60, clarity: 72, structure: 74, visualQuality: 65, storytelling: 70, engagementPotential: 62, retentionPotential: 58, cta: 55, originality: 71, brandConsistency: 80 },
  },
  {
    title: "Carousel: 7 frameworks for better copy",
    content_type: "carousel",
    platform: "instagram",
    goal: "engagement",
    overall_score: 81,
    scores: { hook: 83, clarity: 85, structure: 80, visualQuality: 84, storytelling: 70, engagementPotential: 82, retentionPotential: 75, cta: 68, originality: 78, brandConsistency: 88 },
  },
  {
    title: "Launch day ad creative — v3",
    content_type: "ad_creative",
    platform: "facebook",
    goal: "sales",
    overall_score: 62,
    scores: { hook: 58, clarity: 70, structure: 60, visualQuality: 66, storytelling: 50, engagementPotential: 60, retentionPotential: 55, cta: 72, originality: 54, brandConsistency: 63 },
  },
  {
    title: "The onboarding email that converts",
    content_type: "written_post",
    platform: "linkedin",
    goal: "leads",
    overall_score: 79,
    scores: { hook: 81, clarity: 86, structure: 78, visualQuality: 60, storytelling: 75, engagementPotential: 77, retentionPotential: 74, cta: 83, originality: 72, brandConsistency: 82 },
  },
];

async function main() {
  console.log(`Seeding demo data for ${DEMO_EMAIL}...`);

  const { data: existingUsers } = await admin.auth.admin.listUsers();
  let demoUser = existingUsers.users.find((u) => u.email === DEMO_EMAIL);

  if (!demoUser) {
    const { data, error } = await admin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Demo Creator" },
    });
    if (error) throw error;
    demoUser = data.user;
    console.log(`Created demo user (password: ${DEMO_PASSWORD})`);
  }

  await admin
    .from("profiles")
    .upsert({ id: demoUser.id, full_name: "Demo Creator", niche: "B2B SaaS marketing", onboarding_complete: true });

  await admin.from("content_items").delete().eq("user_id", demoUser.id).eq("is_demo", true);

  for (const [i, seed] of DEMO_ITEMS.entries()) {
    const { data: content, error } = await admin
      .from("content_items")
      .insert({
        user_id: demoUser.id,
        title: seed.title,
        content_type: seed.content_type,
        platform: seed.platform,
        goal: seed.goal,
        source_kind: "text",
        raw_text: `Demo content for "${seed.title}".`,
        status: "analyzed",
        is_demo: true,
        created_at: new Date(Date.now() - (DEMO_ITEMS.length - i) * 86400000).toISOString(),
      })
      .select()
      .single();
    if (error) throw error;

    await admin.from("content_analysis").insert({
      content_id: content.id,
      overall_score: seed.overall_score,
      scores_json: seed.scores,
      summary: `Demo analysis for "${seed.title}".`,
      strengths_json: ["Clear opening", "Consistent tone", "Relevant to the stated goal"],
      weaknesses_json: ["CTA could be more specific", "Pacing slows in the middle section"],
      hook_analysis_json: {
        originalHook: seed.title,
        score: seed.scores.hook,
        whyItWorks: ["Names a concrete problem", "Implies a clear payoff"],
        whatCouldImprove: ["Could be shortened further"],
        alternatives: [
          { label: "Version A", text: `Stop doing this if you want ${seed.goal}.` },
          { label: "Version B", text: `The #1 reason ${seed.title.toLowerCase()}.` },
          { label: "Version C", text: `Nobody tells you this about ${seed.title.toLowerCase()}.` },
        ],
      },
      retention_analysis_json: {
        isPredicted: true,
        timeline: [
          { timestampLabel: "0:00", section: "Hook", risk: "strong", note: "Opens on the problem." },
          { timestampLabel: "0:08", section: "Context", risk: "neutral", note: "Some setup before value." },
          { timestampLabel: "0:20", section: "CTA", risk: "drop_risk", note: "CTA arrives late." },
        ],
        summary: "Predicted retention risk based on structure — no real watch-time data.",
      },
      structure_json: {
        detectedStructure: ["Hook", "Problem", "Insight", "CTA"],
        suggestedStructure: ["Hook", "Problem", "Insight", "Example", "CTA"],
        notes: "Missing a concrete example between insight and CTA.",
      },
      visual_analysis_json: { applicable: false, recommendations: [] },
      cta_analysis_json: {
        present: true,
        text: "Follow for more",
        timingAssessment: "Arrives in the final 15% of the piece.",
        clarity: seed.scores.cta,
        recommendations: ["Make the CTA specific to the goal, not generic."],
      },
      audience_analysis_json: {
        likelyAudience: "Marketers and founders at early-stage SaaS companies",
        relevance: 80,
        notes: "Demo data.",
      },
      data_completeness: "content_only",
      model: "demo-seed",
      prompt_version: "demo",
    });
  }

  console.log(`Seeded ${DEMO_ITEMS.length} demo content items.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
