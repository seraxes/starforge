ALTER TABLE "sf_event_ticket_tiers" ADD COLUMN "member_price" integer;
--> statement-breakpoint
ALTER TABLE "sf_event_ticket_tiers" ADD COLUMN "group_prices" jsonb DEFAULT '[]'::jsonb NOT NULL;
