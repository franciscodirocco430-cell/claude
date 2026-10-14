ALTER TABLE "connected_accounts" ADD COLUMN "signature" text;--> statement-breakpoint
ALTER TABLE "connected_accounts" ADD COLUMN "last_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "connected_accounts" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "sequence_enrollments" ADD COLUMN "first_message_rfc_id" text;--> statement-breakpoint
ALTER TABLE "sequence_enrollments" ADD COLUMN "first_subject" text;--> statement-breakpoint
ALTER TABLE "sequence_enrollments" ADD COLUMN "stop_reason" text;