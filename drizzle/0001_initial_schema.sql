CREATE TYPE "public"."ai_run_status" AS ENUM('ok', 'error');--> statement-breakpoint
CREATE TYPE "public"."ai_run_type" AS ENUM('research', 'draft', 'classify', 'score', 'reply', 'handoff_check');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('instagram', 'facebook', 'tiktok', 'whatsapp', 'email');--> statement-breakpoint
CREATE TYPE "public"."connected_account_status" AS ENUM('active', 'expired', 'revoked', 'error');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('active', 'completed', 'stopped_replied', 'stopped_bounced', 'stopped_unsubscribed', 'stopped_manual');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'dead');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'admin', 'setter');--> statement-breakpoint
CREATE TYPE "public"."message_author" AS ENUM('human', 'ai', 'prospect');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('in', 'out');--> statement-breakpoint
CREATE TYPE "public"."oauth_provider" AS ENUM('google', 'meta', 'tiktok');--> statement-breakpoint
CREATE TYPE "public"."outreach_task_status" AS ENUM('pending', 'ready', 'sent_manual', 'skipped', 'failed');--> statement-breakpoint
CREATE TYPE "public"."prospect_source" AS ENUM('manual', 'csv', 'url', 'public_business_data', 'inbound');--> statement-breakpoint
CREATE TYPE "public"."sequence_status" AS ENUM('draft', 'active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."stage_kind" AS ENUM('open', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."suppression_kind" AS ENUM('email', 'phone', 'handle');--> statement-breakpoint
CREATE TYPE "public"."suppression_reason" AS ENUM('unsubscribed', 'bounced', 'complaint', 'requested', 'manual');--> statement-breakpoint
CREATE TABLE "connected_account_secrets" (
	"connected_account_id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"access_token_enc" text NOT NULL,
	"refresh_token_enc" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connected_account_secrets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "connected_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" "oauth_provider" NOT NULL,
	"channel" "channel",
	"external_id" text NOT NULL,
	"display_name" text,
	"scopes" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" "connected_account_status" DEFAULT 'active' NOT NULL,
	"token_expires_at" timestamp with time zone,
	"daily_send_limit" integer DEFAULT 30 NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"connected_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connected_accounts_org_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "connected_accounts_provider_external_unique" UNIQUE("organization_id","provider","external_id")
);
--> statement-breakpoint
ALTER TABLE "connected_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" DEFAULT 'setter' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_org_user_unique" UNIQUE("organization_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"timezone" text DEFAULT 'America/Argentina/Buenos_Aires' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"niche" text NOT NULL,
	"niche_references" text[] DEFAULT '{}'::text[] NOT NULL,
	"offer" text NOT NULL,
	"icp" text NOT NULL,
	"qualification_criteria" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"qualification_questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"channels" "channel"[] DEFAULT '{}'::channel[] NOT NULL,
	"tone" text,
	"daily_limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"few_shot_examples" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"booking_url" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_org_id_unique" UNIQUE("organization_id","id")
);
--> statement-breakpoint
ALTER TABLE "campaigns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lead_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"prospect_id" uuid NOT NULL,
	"campaign_id" uuid,
	"score" integer DEFAULT 0 NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"stage_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_scores_prospect_campaign_unique" UNIQUE NULLS NOT DISTINCT("organization_id","prospect_id","campaign_id"),
	CONSTRAINT "lead_scores_score_range" CHECK ("lead_scores"."score" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "lead_scores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pipeline_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"kind" "stage_kind" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pipeline_stages_org_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "pipeline_stages_org_key_unique" UNIQUE("organization_id","key")
);
--> statement-breakpoint
ALTER TABLE "pipeline_stages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "prospect_handles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"prospect_id" uuid NOT NULL,
	"channel" "channel" NOT NULL,
	"handle" text,
	"url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prospect_handles_org_channel_handle_unique" UNIQUE("organization_id","channel","handle"),
	CONSTRAINT "prospect_handles_has_value" CHECK ("prospect_handles"."handle" is not null or "prospect_handles"."url" is not null)
);
--> statement-breakpoint
ALTER TABLE "prospect_handles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "prospects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"campaign_id" uuid,
	"full_name" text,
	"company" text,
	"industry" text,
	"website" text,
	"email" text,
	"phone" text,
	"notes" text,
	"source" "prospect_source" DEFAULT 'manual' NOT NULL,
	"timezone" text,
	"whatsapp_opt_in" boolean DEFAULT false NOT NULL,
	"whatsapp_opt_in_at" timestamp with time zone,
	"whatsapp_opt_in_source" text,
	"owner_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prospects_org_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "prospects_whatsapp_opt_in_has_date" CHECK (not "prospects"."whatsapp_opt_in" or "prospects"."whatsapp_opt_in_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "prospects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "research_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"prospect_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"pains" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hooks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "research_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "suppression_list" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" "suppression_kind" NOT NULL,
	"value" text NOT NULL,
	"channel" "channel",
	"reason" "suppression_reason" NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppression_list_org_kind_value_unique" UNIQUE("organization_id","kind","value")
);
--> statement-breakpoint
ALTER TABLE "suppression_list" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"prospect_id" uuid NOT NULL,
	"campaign_id" uuid,
	"channel" "channel" NOT NULL,
	"connected_account_id" uuid,
	"external_thread_id" text,
	"ai_paused" boolean DEFAULT false NOT NULL,
	"ai_paused_reason" text,
	"assigned_to" uuid,
	"last_inbound_at" timestamp with time zone,
	"last_outbound_at" timestamp with time zone,
	"business_messages_since_inbound" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_org_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "conversations_external_thread_unique" UNIQUE("organization_id","channel","external_thread_id")
);
--> statement-breakpoint
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"direction" "message_direction" NOT NULL,
	"author" "message_author" NOT NULL,
	"body" text NOT NULL,
	"sent_by_user_id" uuid,
	"ai_run_id" uuid,
	"external_id" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_conversation_external_unique" UNIQUE("conversation_id","external_id")
);
--> statement-breakpoint
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "outreach_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"campaign_id" uuid,
	"prospect_id" uuid NOT NULL,
	"channel" "channel" NOT NULL,
	"draft_message" text,
	"status" "outreach_task_status" DEFAULT 'pending' NOT NULL,
	"assigned_to" uuid,
	"due_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"skipped_reason" text,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outreach_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "email_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"campaign_id" uuid,
	"name" text NOT NULL,
	"mailbox_account_id" uuid,
	"status" "sequence_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_sequences_org_id_unique" UNIQUE("organization_id","id")
);
--> statement-breakpoint
ALTER TABLE "email_sequences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sequence_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"sequence_id" uuid NOT NULL,
	"prospect_id" uuid NOT NULL,
	"status" "enrollment_status" DEFAULT 'active' NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"next_send_at" timestamp with time zone,
	"last_sent_at" timestamp with time zone,
	"gmail_thread_id" text,
	"stopped_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sequence_enrollments_sequence_prospect_unique" UNIQUE("sequence_id","prospect_id")
);
--> statement-breakpoint
ALTER TABLE "sequence_enrollments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sequence_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"sequence_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"delay_hours" integer DEFAULT 0 NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sequence_steps_sequence_position_unique" UNIQUE("sequence_id","position")
);
--> statement-breakpoint
ALTER TABLE "sequence_steps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"type" "ai_run_type" NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text,
	"input_summary" text,
	"output" jsonb,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12, 6),
	"duration_ms" integer,
	"status" "ai_run_status" DEFAULT 'ok' NOT NULL,
	"error" text,
	"prospect_id" uuid,
	"conversation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"last_error" text,
	"idempotency_key" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "connected_account_secrets" ADD CONSTRAINT "connected_account_secrets_account_fk" FOREIGN KEY ("organization_id","connected_account_id") REFERENCES "public"."connected_accounts"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connected_accounts" ADD CONSTRAINT "connected_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connected_accounts" ADD CONSTRAINT "connected_accounts_connected_by_users_id_fk" FOREIGN KEY ("connected_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_scores" ADD CONSTRAINT "lead_scores_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_scores" ADD CONSTRAINT "lead_scores_prospect_fk" FOREIGN KEY ("organization_id","prospect_id") REFERENCES "public"."prospects"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_scores" ADD CONSTRAINT "lead_scores_campaign_fk" FOREIGN KEY ("organization_id","campaign_id") REFERENCES "public"."campaigns"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_scores" ADD CONSTRAINT "lead_scores_stage_fk" FOREIGN KEY ("organization_id","stage_id") REFERENCES "public"."pipeline_stages"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_handles" ADD CONSTRAINT "prospect_handles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_handles" ADD CONSTRAINT "prospect_handles_prospect_fk" FOREIGN KEY ("organization_id","prospect_id") REFERENCES "public"."prospects"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_campaign_fk" FOREIGN KEY ("organization_id","campaign_id") REFERENCES "public"."campaigns"("organization_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_notes" ADD CONSTRAINT "research_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_notes" ADD CONSTRAINT "research_notes_prospect_fk" FOREIGN KEY ("organization_id","prospect_id") REFERENCES "public"."prospects"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppression_list" ADD CONSTRAINT "suppression_list_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppression_list" ADD CONSTRAINT "suppression_list_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_prospect_fk" FOREIGN KEY ("organization_id","prospect_id") REFERENCES "public"."prospects"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_campaign_fk" FOREIGN KEY ("organization_id","campaign_id") REFERENCES "public"."campaigns"("organization_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_account_fk" FOREIGN KEY ("organization_id","connected_account_id") REFERENCES "public"."connected_accounts"("organization_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sent_by_user_id_users_id_fk" FOREIGN KEY ("sent_by_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_fk" FOREIGN KEY ("organization_id","conversation_id") REFERENCES "public"."conversations"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_tasks" ADD CONSTRAINT "outreach_tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_tasks" ADD CONSTRAINT "outreach_tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_tasks" ADD CONSTRAINT "outreach_tasks_prospect_fk" FOREIGN KEY ("organization_id","prospect_id") REFERENCES "public"."prospects"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_tasks" ADD CONSTRAINT "outreach_tasks_campaign_fk" FOREIGN KEY ("organization_id","campaign_id") REFERENCES "public"."campaigns"("organization_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sequences" ADD CONSTRAINT "email_sequences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sequences" ADD CONSTRAINT "email_sequences_campaign_fk" FOREIGN KEY ("organization_id","campaign_id") REFERENCES "public"."campaigns"("organization_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sequences" ADD CONSTRAINT "email_sequences_mailbox_fk" FOREIGN KEY ("organization_id","mailbox_account_id") REFERENCES "public"."connected_accounts"("organization_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_sequence_fk" FOREIGN KEY ("organization_id","sequence_id") REFERENCES "public"."email_sequences"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_prospect_fk" FOREIGN KEY ("organization_id","prospect_id") REFERENCES "public"."prospects"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_steps" ADD CONSTRAINT "sequence_steps_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_steps" ADD CONSTRAINT "sequence_steps_sequence_fk" FOREIGN KEY ("organization_id","sequence_id") REFERENCES "public"."email_sequences"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "lead_scores_stage_idx" ON "lead_scores" USING btree ("organization_id","stage_id");--> statement-breakpoint
CREATE INDEX "prospect_handles_prospect_idx" ON "prospect_handles" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "prospects_org_email_idx" ON "prospects" USING btree ("organization_id","email");--> statement-breakpoint
CREATE INDEX "prospects_org_phone_idx" ON "prospects" USING btree ("organization_id","phone");--> statement-breakpoint
CREATE INDEX "research_notes_prospect_idx" ON "research_notes" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "conversations_prospect_idx" ON "conversations" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_sent_idx" ON "messages" USING btree ("conversation_id","sent_at");--> statement-breakpoint
CREATE INDEX "outreach_tasks_queue_idx" ON "outreach_tasks" USING btree ("organization_id","assigned_to","status");--> statement-breakpoint
CREATE INDEX "sequence_enrollments_due_idx" ON "sequence_enrollments" USING btree ("status","next_send_at");--> statement-breakpoint
CREATE INDEX "ai_runs_org_created_idx" ON "ai_runs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "jobs_ready_idx" ON "jobs" USING btree ("status","run_at");--> statement-breakpoint
CREATE POLICY "connected_accounts_select" ON "connected_accounts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_org_member("connected_accounts"."organization_id"));--> statement-breakpoint
CREATE POLICY "connected_accounts_insert" ON "connected_accounts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_org_admin("connected_accounts"."organization_id"));--> statement-breakpoint
CREATE POLICY "connected_accounts_update" ON "connected_accounts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_org_admin("connected_accounts"."organization_id")) WITH CHECK (public.is_org_admin("connected_accounts"."organization_id"));--> statement-breakpoint
CREATE POLICY "connected_accounts_delete" ON "connected_accounts" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_org_admin("connected_accounts"."organization_id"));--> statement-breakpoint
CREATE POLICY "memberships_select" ON "memberships" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_org_member("memberships"."organization_id"));--> statement-breakpoint
CREATE POLICY "organizations_select" ON "organizations" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_org_member("organizations"."id"));--> statement-breakpoint
CREATE POLICY "organizations_update" ON "organizations" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_org_admin("organizations"."id")) WITH CHECK (public.is_org_admin("organizations"."id"));--> statement-breakpoint
CREATE POLICY "campaigns_select" ON "campaigns" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_org_member("campaigns"."organization_id"));--> statement-breakpoint
CREATE POLICY "campaigns_insert" ON "campaigns" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_org_admin("campaigns"."organization_id"));--> statement-breakpoint
CREATE POLICY "campaigns_update" ON "campaigns" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_org_admin("campaigns"."organization_id")) WITH CHECK (public.is_org_admin("campaigns"."organization_id"));--> statement-breakpoint
CREATE POLICY "campaigns_delete" ON "campaigns" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_org_admin("campaigns"."organization_id"));--> statement-breakpoint
CREATE POLICY "lead_scores_select" ON "lead_scores" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_org_member("lead_scores"."organization_id"));--> statement-breakpoint
CREATE POLICY "lead_scores_insert" ON "lead_scores" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_org_member("lead_scores"."organization_id"));--> statement-breakpoint
CREATE POLICY "lead_scores_update" ON "lead_scores" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_org_member("lead_scores"."organization_id")) WITH CHECK (public.is_org_member("lead_scores"."organization_id"));--> statement-breakpoint
CREATE POLICY "lead_scores_delete" ON "lead_scores" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_org_admin("lead_scores"."organization_id"));--> statement-breakpoint
CREATE POLICY "pipeline_stages_select" ON "pipeline_stages" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_org_member("pipeline_stages"."organization_id"));--> statement-breakpoint
CREATE POLICY "pipeline_stages_insert" ON "pipeline_stages" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_org_admin("pipeline_stages"."organization_id"));--> statement-breakpoint
CREATE POLICY "pipeline_stages_update" ON "pipeline_stages" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_org_admin("pipeline_stages"."organization_id")) WITH CHECK (public.is_org_admin("pipeline_stages"."organization_id"));--> statement-breakpoint
CREATE POLICY "pipeline_stages_delete" ON "pipeline_stages" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_org_admin("pipeline_stages"."organization_id"));--> statement-breakpoint
CREATE POLICY "prospect_handles_select" ON "prospect_handles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_org_member("prospect_handles"."organization_id"));--> statement-breakpoint
CREATE POLICY "prospect_handles_insert" ON "prospect_handles" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_org_member("prospect_handles"."organization_id"));--> statement-breakpoint
CREATE POLICY "prospect_handles_update" ON "prospect_handles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_org_member("prospect_handles"."organization_id")) WITH CHECK (public.is_org_member("prospect_handles"."organization_id"));--> statement-breakpoint
CREATE POLICY "prospect_handles_delete" ON "prospect_handles" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_org_admin("prospect_handles"."organization_id"));--> statement-breakpoint
CREATE POLICY "prospects_select" ON "prospects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_org_member("prospects"."organization_id"));--> statement-breakpoint
CREATE POLICY "prospects_insert" ON "prospects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_org_member("prospects"."organization_id"));--> statement-breakpoint
CREATE POLICY "prospects_update" ON "prospects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_org_member("prospects"."organization_id")) WITH CHECK (public.is_org_member("prospects"."organization_id"));--> statement-breakpoint
CREATE POLICY "prospects_delete" ON "prospects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_org_admin("prospects"."organization_id"));--> statement-breakpoint
CREATE POLICY "research_notes_select" ON "research_notes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_org_member("research_notes"."organization_id"));--> statement-breakpoint
CREATE POLICY "research_notes_insert" ON "research_notes" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_org_member("research_notes"."organization_id"));--> statement-breakpoint
CREATE POLICY "research_notes_update" ON "research_notes" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_org_member("research_notes"."organization_id")) WITH CHECK (public.is_org_member("research_notes"."organization_id"));--> statement-breakpoint
CREATE POLICY "research_notes_delete" ON "research_notes" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_org_admin("research_notes"."organization_id"));--> statement-breakpoint
CREATE POLICY "suppression_list_select" ON "suppression_list" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_org_member("suppression_list"."organization_id"));--> statement-breakpoint
CREATE POLICY "suppression_list_insert" ON "suppression_list" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_org_member("suppression_list"."organization_id"));--> statement-breakpoint
CREATE POLICY "suppression_list_update" ON "suppression_list" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_org_admin("suppression_list"."organization_id")) WITH CHECK (public.is_org_admin("suppression_list"."organization_id"));--> statement-breakpoint
CREATE POLICY "suppression_list_delete" ON "suppression_list" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_org_admin("suppression_list"."organization_id"));--> statement-breakpoint
CREATE POLICY "conversations_select" ON "conversations" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_org_member("conversations"."organization_id"));--> statement-breakpoint
CREATE POLICY "conversations_insert" ON "conversations" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_org_member("conversations"."organization_id"));--> statement-breakpoint
CREATE POLICY "conversations_update" ON "conversations" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_org_member("conversations"."organization_id")) WITH CHECK (public.is_org_member("conversations"."organization_id"));--> statement-breakpoint
CREATE POLICY "conversations_delete" ON "conversations" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_org_admin("conversations"."organization_id"));--> statement-breakpoint
CREATE POLICY "messages_select" ON "messages" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_org_member("messages"."organization_id"));--> statement-breakpoint
CREATE POLICY "messages_insert" ON "messages" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_org_member("messages"."organization_id"));--> statement-breakpoint
CREATE POLICY "messages_update" ON "messages" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_org_member("messages"."organization_id")) WITH CHECK (public.is_org_member("messages"."organization_id"));--> statement-breakpoint
CREATE POLICY "messages_delete" ON "messages" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_org_admin("messages"."organization_id"));--> statement-breakpoint
CREATE POLICY "outreach_tasks_select" ON "outreach_tasks" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_org_member("outreach_tasks"."organization_id"));--> statement-breakpoint
CREATE POLICY "outreach_tasks_insert" ON "outreach_tasks" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_org_member("outreach_tasks"."organization_id"));--> statement-breakpoint
CREATE POLICY "outreach_tasks_update" ON "outreach_tasks" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_org_member("outreach_tasks"."organization_id")) WITH CHECK (public.is_org_member("outreach_tasks"."organization_id"));--> statement-breakpoint
CREATE POLICY "outreach_tasks_delete" ON "outreach_tasks" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_org_admin("outreach_tasks"."organization_id"));--> statement-breakpoint
CREATE POLICY "email_sequences_select" ON "email_sequences" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_org_member("email_sequences"."organization_id"));--> statement-breakpoint
CREATE POLICY "email_sequences_insert" ON "email_sequences" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_org_admin("email_sequences"."organization_id"));--> statement-breakpoint
CREATE POLICY "email_sequences_update" ON "email_sequences" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_org_admin("email_sequences"."organization_id")) WITH CHECK (public.is_org_admin("email_sequences"."organization_id"));--> statement-breakpoint
CREATE POLICY "email_sequences_delete" ON "email_sequences" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_org_admin("email_sequences"."organization_id"));--> statement-breakpoint
CREATE POLICY "sequence_enrollments_select" ON "sequence_enrollments" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_org_member("sequence_enrollments"."organization_id"));--> statement-breakpoint
CREATE POLICY "sequence_enrollments_insert" ON "sequence_enrollments" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_org_member("sequence_enrollments"."organization_id"));--> statement-breakpoint
CREATE POLICY "sequence_enrollments_update" ON "sequence_enrollments" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_org_member("sequence_enrollments"."organization_id")) WITH CHECK (public.is_org_member("sequence_enrollments"."organization_id"));--> statement-breakpoint
CREATE POLICY "sequence_enrollments_delete" ON "sequence_enrollments" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_org_admin("sequence_enrollments"."organization_id"));--> statement-breakpoint
CREATE POLICY "sequence_steps_select" ON "sequence_steps" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_org_member("sequence_steps"."organization_id"));--> statement-breakpoint
CREATE POLICY "sequence_steps_insert" ON "sequence_steps" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_org_admin("sequence_steps"."organization_id"));--> statement-breakpoint
CREATE POLICY "sequence_steps_update" ON "sequence_steps" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_org_admin("sequence_steps"."organization_id")) WITH CHECK (public.is_org_admin("sequence_steps"."organization_id"));--> statement-breakpoint
CREATE POLICY "sequence_steps_delete" ON "sequence_steps" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_org_admin("sequence_steps"."organization_id"));--> statement-breakpoint
CREATE POLICY "ai_runs_select" ON "ai_runs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_org_member("ai_runs"."organization_id"));