ALTER TABLE "sf_profiles" ADD COLUMN "avatar_frame" jsonb DEFAULT '{"x":50,"y":50,"zoom":1}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_profiles" ADD COLUMN "cover_frame" jsonb DEFAULT '{"x":50,"y":50,"zoom":1}'::jsonb NOT NULL;
