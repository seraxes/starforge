ALTER TABLE "sf_events" ADD COLUMN "series_id" text;
--> statement-breakpoint
ALTER TABLE "sf_events" ADD COLUMN "series_pattern" jsonb;
--> statement-breakpoint
CREATE INDEX "sf_events_series_id_idx" ON "sf_events" USING btree ("series_id");
