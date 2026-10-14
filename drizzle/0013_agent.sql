CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"prospect_id" uuid NOT NULL,
	"conversation_id" uuid,
	"campaign_id" uuid,
	"calendar_account_id" uuid,
	"external_event_id" text NOT NULL,
	"html_link" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meetings_org_event_unique" UNIQUE("organization_id","external_event_id")
);
--> statement-breakpoint
ALTER TABLE "meetings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"conversation_id" uuid,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "agent_settings" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "agent_state" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_prospect_fk" FOREIGN KEY ("organization_id","prospect_id") REFERENCES "public"."prospects"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_conversation_fk" FOREIGN KEY ("organization_id","conversation_id") REFERENCES "public"."conversations"("organization_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_campaign_fk" FOREIGN KEY ("organization_id","campaign_id") REFERENCES "public"."campaigns"("organization_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_calendar_account_fk" FOREIGN KEY ("organization_id","calendar_account_id") REFERENCES "public"."connected_accounts"("organization_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_conversation_fk" FOREIGN KEY ("organization_id","conversation_id") REFERENCES "public"."conversations"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meetings_org_starts_idx" ON "meetings" USING btree ("organization_id","starts_at");--> statement-breakpoint
CREATE INDEX "notifications_org_unread_idx" ON "notifications" USING btree ("organization_id","read_at");--> statement-breakpoint
CREATE POLICY "meetings_select" ON "meetings" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_org_member("meetings"."organization_id"));--> statement-breakpoint
CREATE POLICY "notifications_select" ON "notifications" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_org_member("notifications"."organization_id"));--> statement-breakpoint
CREATE POLICY "notifications_update" ON "notifications" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_org_member("notifications"."organization_id")) WITH CHECK (public.is_org_member("notifications"."organization_id"));