-- Social base tables were historically pushed, not created by an earlier
-- migration. Skip the additive column when the table is absent (empty CI DB).
DO $$ BEGIN
  IF to_regclass('public.sf_social_posts') IS NOT NULL THEN
    ALTER TABLE "sf_social_posts" ADD COLUMN IF NOT EXISTS "pending_review" boolean DEFAULT false NOT NULL;
  END IF;
END $$;
