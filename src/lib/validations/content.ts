import { z } from "zod";
import type { ContentType, Platform, ContentGoal } from "@/lib/types/database.types";

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

const contentTypeValues = CONTENT_TYPES.map((c) => c.value) as [ContentType, ...ContentType[]];
const platformValues = PLATFORMS.map((p) => p.value) as [Platform, ...Platform[]];
const goalValues = GOALS.map((g) => g.value) as [ContentGoal, ...ContentGoal[]];

export const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"];
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ACCEPTED_TEXT_TYPES = ["text/plain", "text/markdown"];
export const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500MB

export const CreateContentSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  contentType: z.enum(contentTypeValues),
  platform: z.enum(platformValues),
  goal: z.enum(goalValues).optional().nullable(),
  topic: z.string().max(200).optional().nullable(),
  campaignId: z.string().uuid().optional().nullable(),
  sourceKind: z.enum(["file", "text", "url"]),
  rawText: z.string().max(50000).optional().nullable(),
  sourceUrl: z.string().url().optional().nullable(),
  storagePath: z.string().optional().nullable(),
  mimeType: z.string().optional().nullable(),
  fileSizeBytes: z.number().optional().nullable(),
  durationSeconds: z.number().optional().nullable(),
});

export type CreateContentInput = z.infer<typeof CreateContentSchema>;

export const MetricsSchema = z.object({
  views: z.number().int().nonnegative().optional(),
  reach: z.number().int().nonnegative().optional(),
  impressions: z.number().int().nonnegative().optional(),
  likes: z.number().int().nonnegative().optional(),
  comments: z.number().int().nonnegative().optional(),
  shares: z.number().int().nonnegative().optional(),
  saves: z.number().int().nonnegative().optional(),
  watchTimeSeconds: z.number().nonnegative().optional(),
  averageWatchTimeSeconds: z.number().nonnegative().optional(),
  completionRate: z.number().min(0).max(100).optional(),
  clicks: z.number().int().nonnegative().optional(),
  leads: z.number().int().nonnegative().optional(),
  conversions: z.number().int().nonnegative().optional(),
});

export type MetricsInput = z.infer<typeof MetricsSchema>;

export const DashboardLayoutSchema = z.array(z.string());

export const ProfileUpdateSchema = z.object({
  fullName: z.string().max(200).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  niche: z.string().max(200).optional().nullable(),
  targetAudience: z.string().max(300).optional().nullable(),
  contentTone: z.string().max(200).optional().nullable(),
  contentGoals: z.string().max(300).optional().nullable(),
});

export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;
