export type ContentType =
  | "reel"
  | "tiktok"
  | "youtube_short"
  | "long_form_video"
  | "carousel"
  | "static_image"
  | "ad_creative"
  | "written_post"
  | "script"
  | "other";

export type Platform =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "linkedin"
  | "x"
  | "facebook"
  | "other";

export type ContentGoal =
  | "awareness"
  | "engagement"
  | "followers"
  | "leads"
  | "sales"
  | "education"
  | "authority"
  | "community";

export type ContentStatus = "uploaded" | "processing" | "analyzed" | "failed";
export type SourceKind = "file" | "text" | "url";
export type AssetType = "original" | "thumbnail" | "frame" | "audio" | "transcript";
export type DataCompleteness = "content_only" | "with_metrics";
export type Priority = "high" | "medium" | "low";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          company: string | null;
          role: string | null;
          onboarding_complete: boolean;
          niche: string | null;
          target_audience: string | null;
          content_tone: string | null;
          content_goals: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      campaigns: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          goal: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["campaigns"]["Row"]> & {
          user_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["campaigns"]["Row"]>;
        Relationships: [];
      };
      content_items: {
        Row: {
          id: string;
          user_id: string;
          campaign_id: string | null;
          title: string;
          content_type: ContentType;
          platform: Platform;
          goal: ContentGoal | null;
          topic: string | null;
          status: ContentStatus;
          source_kind: SourceKind;
          raw_text: string | null;
          source_url: string | null;
          storage_url: string | null;
          thumbnail_url: string | null;
          duration_seconds: number | null;
          file_size_bytes: number | null;
          is_demo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["content_items"]["Row"]> & {
          user_id: string;
          title: string;
          content_type: ContentType;
          platform: Platform;
        };
        Update: Partial<Database["public"]["Tables"]["content_items"]["Row"]>;
        Relationships: [];
      };
      content_assets: {
        Row: {
          id: string;
          content_id: string;
          asset_type: AssetType;
          storage_path: string;
          metadata_json: Record<string, unknown>;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["content_assets"]["Row"]> & {
          content_id: string;
          asset_type: AssetType;
          storage_path: string;
        };
        Update: Partial<Database["public"]["Tables"]["content_assets"]["Row"]>;
        Relationships: [];
      };
      content_analysis: {
        Row: {
          id: string;
          content_id: string;
          overall_score: number;
          scores_json: Record<string, number>;
          summary: string | null;
          strengths_json: string[];
          weaknesses_json: string[];
          hook_analysis_json: Record<string, unknown>;
          retention_analysis_json: Record<string, unknown>;
          structure_json: Record<string, unknown>;
          visual_analysis_json: Record<string, unknown>;
          cta_analysis_json: Record<string, unknown>;
          audience_analysis_json: Record<string, unknown>;
          data_completeness: DataCompleteness;
          model: string;
          prompt_version: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["content_analysis"]["Row"]> & {
          content_id: string;
          overall_score: number;
          model: string;
          prompt_version: string;
        };
        Update: Partial<Database["public"]["Tables"]["content_analysis"]["Row"]>;
        Relationships: [];
      };
      content_metrics: {
        Row: {
          id: string;
          content_id: string;
          views: number | null;
          reach: number | null;
          impressions: number | null;
          likes: number | null;
          comments: number | null;
          shares: number | null;
          saves: number | null;
          watch_time_seconds: number | null;
          average_watch_time_seconds: number | null;
          completion_rate: number | null;
          clicks: number | null;
          ctr: number | null;
          leads: number | null;
          conversions: number | null;
          captured_at: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["content_metrics"]["Row"]> & {
          content_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["content_metrics"]["Row"]>;
        Relationships: [];
      };
      recommendations: {
        Row: {
          id: string;
          content_id: string;
          title: string;
          why_it_matters: string;
          evidence: string;
          recommended_action: string;
          expected_improvement_area: string;
          priority: Priority;
          suggested_rewrite: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["recommendations"]["Row"]> & {
          content_id: string;
          title: string;
          why_it_matters: string;
          evidence: string;
          recommended_action: string;
          expected_improvement_area: string;
          priority: Priority;
        };
        Update: Partial<Database["public"]["Tables"]["recommendations"]["Row"]>;
        Relationships: [];
      };
      content_ideas: {
        Row: {
          id: string;
          content_id: string;
          title: string;
          hook: string;
          angle: string;
          format: string;
          suggested_structure_json: string[];
          cta: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["content_ideas"]["Row"]> & {
          content_id: string;
          title: string;
          hook: string;
          angle: string;
          format: string;
          cta: string;
        };
        Update: Partial<Database["public"]["Tables"]["content_ideas"]["Row"]>;
        Relationships: [];
      };
      dashboard_layouts: {
        Row: {
          user_id: string;
          layout_json: string[];
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["dashboard_layouts"]["Row"]> & {
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["dashboard_layouts"]["Row"]>;
        Relationships: [];
      };
      profile_reel_ideas: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          hook: string;
          angle: string;
          format: string;
          suggested_structure_json: string[];
          cta: string;
          model: string;
          prompt_version: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profile_reel_ideas"]["Row"]> & {
          user_id: string;
          title: string;
          hook: string;
          angle: string;
          format: string;
          cta: string;
          model: string;
          prompt_version: string;
        };
        Update: Partial<Database["public"]["Tables"]["profile_reel_ideas"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
