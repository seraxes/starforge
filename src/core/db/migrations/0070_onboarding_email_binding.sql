ALTER TABLE "sf_onboarding_statuses" ADD COLUMN IF NOT EXISTS "reminder_template_id" text DEFAULT '' NOT NULL;
