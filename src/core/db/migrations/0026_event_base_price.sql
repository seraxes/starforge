ALTER TABLE "sf_events" ADD COLUMN "price" integer;--> statement-breakpoint
ALTER TABLE "sf_events" ADD COLUMN "price_rules" jsonb DEFAULT '{"time":null,"sold":null}'::jsonb NOT NULL;
