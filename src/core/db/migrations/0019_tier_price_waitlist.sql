ALTER TABLE "sf_event_ticket_tiers" ADD COLUMN "price" integer;--> statement-breakpoint
ALTER TABLE "sf_event_ticket_tiers" ADD COLUMN "price_modifier" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_events" ADD COLUMN "waitlist_enabled" boolean DEFAULT true NOT NULL;
