ALTER TABLE "sf_onboarding_statuses" ADD COLUMN IF NOT EXISTS "phase" text DEFAULT 'recruiting' NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_onboarding_statuses" ADD COLUMN IF NOT EXISTS "display_label" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_onboarding_statuses" ADD COLUMN IF NOT EXISTS "action_chip" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_onboarding_statuses" ADD COLUMN IF NOT EXISTS "next_step_message" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sf_onboarding_statuses_phase_idx" ON "sf_onboarding_statuses" USING btree ("phase");--> statement-breakpoint
UPDATE "sf_onboarding_statuses" SET "phase" = 'recruiting', "display_label" = CASE WHEN trim("display_label") = '' THEN "name" ELSE "display_label" END, "bookable" = false WHERE "key" = 'recruiting';--> statement-breakpoint
UPDATE "sf_onboarding_statuses" SET "phase" = 'active', "display_label" = CASE WHEN trim("display_label") = '' THEN "name" ELSE "display_label" END, "bookable" = true WHERE "key" = 'active';--> statement-breakpoint
UPDATE "sf_onboarding_statuses" SET "phase" = 'inactive', "display_label" = CASE WHEN trim("display_label") = '' THEN "name" ELSE "display_label" END, "bookable" = false WHERE "key" = 'inactive';--> statement-breakpoint
UPDATE "sf_onboarding_statuses" SET "phase" = 'declined', "display_label" = CASE WHEN trim("display_label") = '' THEN "name" ELSE "display_label" END, "bookable" = false WHERE "key" = 'closed';--> statement-breakpoint
UPDATE "sf_onboarding_statuses" SET "phase" = 'banned', "display_label" = CASE WHEN trim("display_label") = '' THEN "name" ELSE "display_label" END, "bookable" = false WHERE "key" = 'banned';
