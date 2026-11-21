CREATE TABLE "sf_email_campaign_recipients" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_email_campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text DEFAULT 'Untitled campaign' NOT NULL,
	"template_id" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"broadcast_id" text,
	"module_category" text DEFAULT 'other' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sf_email_campaign_recipients" ADD CONSTRAINT "sf_email_campaign_recipients_campaign_id_sf_email_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."sf_email_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_email_campaigns" ADD CONSTRAINT "sf_email_campaigns_template_id_sf_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."sf_email_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sf_email_campaign_recipients_campaign_id_idx" ON "sf_email_campaign_recipients" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "sf_email_campaigns_status_idx" ON "sf_email_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sf_email_campaigns_template_id_idx" ON "sf_email_campaigns" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "sf_email_campaigns_updated_at_idx" ON "sf_email_campaigns" USING btree ("updated_at");