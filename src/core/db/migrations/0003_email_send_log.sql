CREATE TABLE "sf_email_sends" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'failed' NOT NULL,
	"email_type" text DEFAULT 'transactional' NOT NULL,
	"provider" text DEFAULT 'console' NOT NULL,
	"to_address" text DEFAULT '' NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"title" text,
	"error" text,
	"source" text,
	"rule_id" text,
	"template_id" text,
	"module_category" text,
	"provider_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sf_email_sends_email_type_idx" ON "sf_email_sends" USING btree ("email_type");--> statement-breakpoint
CREATE INDEX "sf_email_sends_status_idx" ON "sf_email_sends" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sf_email_sends_created_at_idx" ON "sf_email_sends" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sf_email_sends_type_status_idx" ON "sf_email_sends" USING btree ("email_type","status");