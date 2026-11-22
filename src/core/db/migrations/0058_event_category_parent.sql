ALTER TABLE "sf_event_categories" ADD COLUMN IF NOT EXISTS "parent_id" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sf_event_categories_parent_idx" ON "sf_event_categories" USING btree ("parent_id");
