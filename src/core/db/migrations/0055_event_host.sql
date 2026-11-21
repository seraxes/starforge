ALTER TABLE "sf_events" ADD COLUMN IF NOT EXISTS "host_module" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_events" ADD COLUMN IF NOT EXISTS "host_kind" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_events" ADD COLUMN IF NOT EXISTS "host_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sf_events_host_idx" ON "sf_events" USING btree ("host_module","host_kind","host_id");
