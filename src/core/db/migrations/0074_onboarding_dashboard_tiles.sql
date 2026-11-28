ALTER TABLE "sf_onboarding_statuses" ADD COLUMN IF NOT EXISTS "page_id" text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE TABLE "sf_onboarding_dashboard_tiles" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"icon" text DEFAULT '' NOT NULL,
	"url" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"status_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"staff_only" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sf_onboarding_dashboard_tiles_sort_idx" ON "sf_onboarding_dashboard_tiles" USING btree ("sort_order");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_dashboard_tiles_published_idx" ON "sf_onboarding_dashboard_tiles" USING btree ("published");
