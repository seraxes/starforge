ALTER TABLE "sf_events" ADD COLUMN "self_cancel_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_events" ADD COLUMN "switch_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "sf_events"
SET
  "self_cancel_enabled" = true,
  "switch_enabled" = true
WHERE "cancellation_closes_at" IS NOT NULL;
