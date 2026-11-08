ALTER TABLE "sf_event_registrations" ADD COLUMN "payment_order_id" text;
--> statement-breakpoint
CREATE INDEX "sf_event_registrations_payment_order_id_idx" ON "sf_event_registrations" USING btree ("payment_order_id");
