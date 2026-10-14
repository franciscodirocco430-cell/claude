ALTER TABLE "email_sequences" ADD COLUMN "send_start_hour" integer DEFAULT 9 NOT NULL;--> statement-breakpoint
ALTER TABLE "email_sequences" ADD COLUMN "send_end_hour" integer DEFAULT 18 NOT NULL;--> statement-breakpoint
ALTER TABLE "email_sequences" ADD COLUMN "send_days" integer[] DEFAULT '{1,2,3,4,5}'::integer[] NOT NULL;--> statement-breakpoint
ALTER TABLE "email_sequences" ADD CONSTRAINT "email_sequences_send_hours" CHECK ("email_sequences"."send_start_hour" >= 0 and "email_sequences"."send_end_hour" <= 24 and "email_sequences"."send_start_hour" < "email_sequences"."send_end_hour");