ALTER TABLE "sf_event_registrations" ADD COLUMN "checked_in_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX "sf_event_registrations_checked_in_at_idx" ON "sf_event_registrations" USING btree ("checked_in_at");
