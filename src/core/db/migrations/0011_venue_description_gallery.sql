ALTER TABLE "sf_venues" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_venues" ADD COLUMN "gallery_media_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;
