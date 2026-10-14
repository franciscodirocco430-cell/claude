ALTER TABLE "outreach_tasks" ADD COLUMN "sent_by" uuid;--> statement-breakpoint
ALTER TABLE "outreach_tasks" ADD CONSTRAINT "outreach_tasks_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outreach_tasks_sent_idx" ON "outreach_tasks" USING btree ("organization_id","sent_by","sent_at");