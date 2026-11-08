ALTER TABLE "sf_events" ADD COLUMN "featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "sf_events_featured_idx" ON "sf_events" USING btree ("featured");
