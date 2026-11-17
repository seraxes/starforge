ALTER TABLE "sf_sub_plans" ADD COLUMN IF NOT EXISTS "billing_interval_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_sub_periods" ADD COLUMN IF NOT EXISTS "billing_interval_count" integer DEFAULT 1 NOT NULL;
