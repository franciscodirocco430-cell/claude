CREATE TABLE "lead_stage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lead_score_id" uuid NOT NULL,
	"prospect_id" uuid NOT NULL,
	"campaign_id" uuid,
	"stage_id" uuid NOT NULL,
	"stage_key" text NOT NULL,
	"actor_user_id" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead_stage_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lead_stage_events" ADD CONSTRAINT "lead_stage_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_stage_events" ADD CONSTRAINT "lead_stage_events_prospect_fk" FOREIGN KEY ("organization_id","prospect_id") REFERENCES "public"."prospects"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_stage_events_org_at_idx" ON "lead_stage_events" USING btree ("organization_id","at");--> statement-breakpoint
CREATE INDEX "lead_stage_events_lead_idx" ON "lead_stage_events" USING btree ("lead_score_id");--> statement-breakpoint
CREATE POLICY "lead_stage_events_select" ON "lead_stage_events" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_org_member("lead_stage_events"."organization_id"));