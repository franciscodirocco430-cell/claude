CREATE TYPE "public"."prospect_ai_status" AS ENUM('idle', 'queued', 'researching', 'drafting', 'ready', 'error');--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "ai_status" "prospect_ai_status" DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "ai_error" text;--> statement-breakpoint
ALTER TABLE "research_notes" ADD COLUMN "job_id" uuid;--> statement-breakpoint
ALTER TABLE "outreach_tasks" ADD COLUMN "draft_subject" text;--> statement-breakpoint
ALTER TABLE "outreach_tasks" ADD COLUMN "ai_run_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "outreach_tasks_open_unique" ON "outreach_tasks" USING btree ("organization_id","prospect_id","channel") WHERE "outreach_tasks"."status" in ('pending', 'ready');--> statement-breakpoint
ALTER TABLE "research_notes" ADD CONSTRAINT "research_notes_job_id_unique" UNIQUE("job_id");