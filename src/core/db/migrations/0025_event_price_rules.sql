ALTER TABLE "sf_events" ADD COLUMN "currency" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_event_ticket_tiers" ADD COLUMN "price_rules" jsonb DEFAULT '{"time":null,"sold":null}'::jsonb NOT NULL;
