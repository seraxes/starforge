ALTER TABLE "sf_events" ADD COLUMN "cancellation_closes_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sf_events" ADD COLUMN "self_cancel_refund" boolean DEFAULT false NOT NULL;
