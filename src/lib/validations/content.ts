import { z } from "zod";

export const CONTENT_TYPES = [
  { value: "reel", label: "Reel" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube_short", label: "YouTube Short" },
  { value: "long_form_video", label: "Long-form video" },
  { value: "carousel", label: "Carousel" },
  { value: "static_image", label: "Static image" },
  { value: "ad_creative", label: "Ad creative" },
  { value: "written_post", label: "Written post" },
  { value: "script", label: "Script" },
  { value: "other", label: "Other" },
] as const;

export const PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "x", label: "X" },
  { value: "facebook", label: "Facebook" },
  { value: "other", label: "Other" },
] as const;

export const GOALS = [
  { value: "awareness", label: "Awareness" },
  { value: "engagement", label: "Engagement" },
  { value: "followers", label: "Followers" },
  { value: "leads", label: "Leads" },
  { value: "sales", label: "Sales" },
  { value: "education", label: "Education" },
  { value: "authority", label: "Authority" },
  { value: "community", label: "Community" },
] as const;

const contentTypeValues = CONTENT_TYPES.map((c) => c.value) as [string, ...string[]];
const platformValues = PLATFORMS.map((p) => p.value) as [string, ...string[]];
const goalValues = GOALS.map((g) => g.value) as [string, ...string[]];

export const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"];
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ACCEPTED_TEXT_TYPES = ["text/plain", "text/markdown"];
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB — everything travels in the request body, nothing is stored server-side.

export const AnalyzeRequestSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  contentType: z.enum(contentTypeValues),
  platform: z.enum(platformValues),
  goal: z.enum(goalValues).optional().nullable(),
  topic: z.string().max(200).optional().nullable(),
  rawText: z.string().max(50000).optional().nullable(),
  durationSeconds: z.number().optional().nullable(),
  image: z
    .object({
      mediaType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
      base64Data: z.string().max(20_000_000),
    })
    .optional()
    .nullable(),
});

export type AnalyzeRequestInput = z.infer<typeof AnalyzeRequestSchema>;

export const RegenerateRecommendationsRequestSchema = z.object({
  title: z.string(),
  contentType: z.string(),
  summary: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  scores: z.record(z.number()),
});

export const RegenerateIdeasRequestSchema = z.object({
  title: z.string(),
  contentType: z.string(),
  platform: z.string(),
  topic: z.string().nullable().optional(),
  summary: z.string(),
});

export const ReelIdeasRequestSchema = z.object({
  niche: z.string().min(1, "Niche is required").max(200),
  targetAudience: z.string().max(300).optional().nullable(),
  contentTone: z.string().max(200).optional().nullable(),
  contentGoals: z.string().max(300).optional().nullable(),
});

export type ReelIdeasRequestInput = z.infer<typeof ReelIdeasRequestSchema>;
