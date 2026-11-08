ALTER TABLE "sf_events" ADD COLUMN "merchant_user_id" text;
--> statement-breakpoint
CREATE INDEX "sf_events_merchant_user_id_idx" ON "sf_events" USING btree ("merchant_user_id");
