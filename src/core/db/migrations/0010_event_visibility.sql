ALTER TABLE "sf_events" ADD COLUMN "listed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_events" ADD COLUMN "access_password_hash" text;--> statement-breakpoint
CREATE INDEX "sf_events_listed_idx" ON "sf_events" USING btree ("listed");
