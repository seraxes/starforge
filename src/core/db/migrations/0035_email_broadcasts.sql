CREATE TABLE "sf_email_broadcasts" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text DEFAULT 'Untitled broadcast' NOT NULL,
	"template_id" text NOT NULL,
	"module_category" text DEFAULT 'other' NOT NULL,
	"source_key" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"batch_size" integer DEFAULT 20 NOT NULL,
	"gap_minutes" integer DEFAULT 10 NOT NULL,
	"total_count" integer DEFAULT 0 NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"next_run_at" timestamp with time zone,
	"last_error" text,
	"from_override" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sf_email_broadcasts" ADD CONSTRAINT "sf_email_broadcasts_template_id_sf_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."sf_email_templates"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "sf_email_broadcasts_status_idx" ON "sf_email_broadcasts" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "sf_email_broadcasts_source_key_idx" ON "sf_email_broadcasts" USING btree ("source_key");
--> statement-breakpoint
CREATE INDEX "sf_email_broadcasts_next_run_at_idx" ON "sf_email_broadcasts" USING btree ("next_run_at");
--> statement-breakpoint
CREATE INDEX "sf_email_broadcasts_created_at_idx" ON "sf_email_broadcasts" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "sf_email_broadcasts_template_id_idx" ON "sf_email_broadcasts" USING btree ("template_id");
--> statement-breakpoint
CREATE TABLE "sf_email_broadcast_recipients" (
	"id" text PRIMARY KEY NOT NULL,
	"broadcast_id" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sf_email_broadcast_recipients" ADD CONSTRAINT "sf_email_broadcast_recipients_broadcast_id_sf_email_broadcasts_id_fk" FOREIGN KEY ("broadcast_id") REFERENCES "public"."sf_email_broadcasts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "sf_email_broadcast_recipients_broadcast_id_idx" ON "sf_email_broadcast_recipients" USING btree ("broadcast_id");
--> statement-breakpoint
CREATE INDEX "sf_email_broadcast_recipients_status_idx" ON "sf_email_broadcast_recipients" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "sf_email_broadcast_recipients_broadcast_status_idx" ON "sf_email_broadcast_recipients" USING btree ("broadcast_id","status");
