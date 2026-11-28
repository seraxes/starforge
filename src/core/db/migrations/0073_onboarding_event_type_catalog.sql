CREATE TABLE "sf_onboarding_event_types" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"template_id" text DEFAULT '' NOT NULL,
	"form_definition_id" text DEFAULT '' NOT NULL,
	"date_field_names" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active_status_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completed_status_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sf_onboarding_event_types_key_uidx" ON "sf_onboarding_event_types" USING btree ("key");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_event_types_sort_idx" ON "sf_onboarding_event_types" USING btree ("sort_order");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_event_types_enabled_idx" ON "sf_onboarding_event_types" USING btree ("enabled");
