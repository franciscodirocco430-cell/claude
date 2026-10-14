DROP INDEX "prospects_org_email_idx";--> statement-breakpoint
DROP INDEX "prospects_org_phone_idx";--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "website_domain" text;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "source_ref" text;--> statement-breakpoint
CREATE UNIQUE INDEX "prospects_org_email_unique" ON "prospects" USING btree ("organization_id","email") WHERE "prospects"."email" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "prospects_org_phone_unique" ON "prospects" USING btree ("organization_id","phone") WHERE "prospects"."phone" is not null;--> statement-breakpoint
CREATE INDEX "prospects_org_domain_idx" ON "prospects" USING btree ("organization_id","website_domain");--> statement-breakpoint
CREATE INDEX "prospects_org_campaign_idx" ON "prospects" USING btree ("organization_id","campaign_id");