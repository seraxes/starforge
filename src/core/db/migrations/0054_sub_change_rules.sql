ALTER TABLE "sf_sub_periods" ADD COLUMN IF NOT EXISTS "scheduled_plan_id" text;
--> statement-breakpoint
ALTER TABLE "sf_sub_periods" ADD COLUMN IF NOT EXISTS "group_synced_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "sf_sub_upgrade_paths" ADD COLUMN IF NOT EXISTS "credit_mode" text DEFAULT 'prorate' NOT NULL;
