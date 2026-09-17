import { z } from "zod";

export const ScoreSchema = z.number().min(0).max(100);

export const ContentScoresSchema = z.object({
  hook: ScoreSchema,
  clarity: ScoreSchema,
  structure: ScoreSchema,
  visualQuality: ScoreSchema,
  storytelling: ScoreSchema,
  engagementPotential: ScoreSchema,
  retentionPotential: ScoreSchema,
  cta: ScoreSchema,
  originality: ScoreSchema,
  brandConsistency: ScoreSchema,
});

export type ContentScores = z.infer<typeof ContentScoresSchema>;

export const HookAnalysisSchema = z.object({
  originalHook: z.string(),
  score: ScoreSchema,
  whyItWorks: z.array(z.string()),
  whatCouldImprove: z.array(z.string()),
  alternatives: z
    .array(
      z.object({
        label: z.string(),
        text: z.string(),
      })
    )
    .max(3),
});

export const RetentionTimelinePointSchema = z.object({
  timestampLabel: z.string(),
  section: z.string(),
  risk: z.enum(["strong", "neutral", "drop_risk"]),
  note: z.string(),
});

export const RetentionAnalysisSchema = z.object({
  isPredicted: z.boolean(),
  timeline: z.array(RetentionTimelinePointSchema),
  summary: z.string(),
});

export const StructureAnalysisSchema = z.object({
  detectedStructure: z.array(z.string()),
  suggestedStructure: z.array(z.string()),
  notes: z.string(),
});

export const VisualAnalysisSchema = z.object({
  applicable: z.boolean(),
  subjectClarity: ScoreSchema.optional(),
  contrast: ScoreSchema.optional(),
  composition: ScoreSchema.optional(),
  textReadability: ScoreSchema.optional(),
  visualHierarchy: ScoreSchema.optional(),
  branding: ScoreSchema.optional(),
  thumbnailStrength: ScoreSchema.optional(),
  scrollStoppingPower: ScoreSchema.optional(),
  recommendations: z.array(z.string()),
});

export const CtaAnalysisSchema = z.object({
  present: z.boolean(),
  text: z.string().nullable(),
  timingAssessment: z.string(),
  clarity: ScoreSchema,
  recommendations: z.array(z.string()),
});

export const AudienceAnalysisSchema = z.object({
  likelyAudience: z.string(),
  relevance: ScoreSchema,
  notes: z.string(),
});

export const RecommendationSchema = z.object({
  title: z.string(),
  whyItMatters: z.string(),
  evidence: z.string(),
  recommendedAction: z.string(),
  expectedImprovementArea: z.string(),
  priority: z.enum(["high", "medium", "low"]),
  suggestedRewrite: z.string().nullable(),
});

export const ContentIdeaSchema = z.object({
  title: z.string(),
  hook: z.string(),
  angle: z.string(),
  format: z.string(),
  suggestedStructure: z.array(z.string()),
  cta: z.string(),
});

export const ContentAnalysisResultSchema = z.object({
  overallScore: ScoreSchema,
  summary: z.string(),
  dataDisclaimer: z.string(),
  scores: ContentScoresSchema,
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  recommendations: z.array(RecommendationSchema),
  hookAnalysis: HookAnalysisSchema,
  retentionAnalysis: RetentionAnalysisSchema,
  structureAnalysis: StructureAnalysisSchema,
  ctaAnalysis: CtaAnalysisSchema,
  visualAnalysis: VisualAnalysisSchema,
  audienceAnalysis: AudienceAnalysisSchema,
  nextContentIdeas: z.array(ContentIdeaSchema).min(3).max(5),
});

export type ContentAnalysisResult = z.infer<typeof ContentAnalysisResultSchema>;
export type Recommendation = z.infer<typeof RecommendationSchema>;
export type ContentIdea = z.infer<typeof ContentIdeaSchema>;
