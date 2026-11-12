ALTER TABLE "sf_events" ADD COLUMN "cover_media_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_events" ADD COLUMN "cover_display_mode" text DEFAULT 'static' NOT NULL;
