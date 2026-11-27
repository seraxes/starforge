ALTER TABLE "sf_social_posts" ADD COLUMN IF NOT EXISTS "pending_review" boolean DEFAULT false NOT NULL;
