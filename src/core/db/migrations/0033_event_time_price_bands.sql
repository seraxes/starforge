UPDATE "sf_events"
SET "price_rules" = jsonb_set(
  "price_rules",
  '{time}',
  CASE
    WHEN "price_rules"->'time' IS NULL OR jsonb_typeof("price_rules"->'time') = 'null' THEN '[]'::jsonb
    WHEN jsonb_typeof("price_rules"->'time') = 'array' THEN "price_rules"->'time'
    WHEN jsonb_typeof("price_rules"->'time') = 'object' THEN jsonb_build_array("price_rules"->'time')
    ELSE '[]'::jsonb
  END
);--> statement-breakpoint
UPDATE "sf_event_ticket_tiers"
SET "price_rules" = jsonb_set(
  "price_rules",
  '{time}',
  CASE
    WHEN "price_rules"->'time' IS NULL OR jsonb_typeof("price_rules"->'time') = 'null' THEN '[]'::jsonb
    WHEN jsonb_typeof("price_rules"->'time') = 'array' THEN "price_rules"->'time'
    WHEN jsonb_typeof("price_rules"->'time') = 'object' THEN jsonb_build_array("price_rules"->'time')
    ELSE '[]'::jsonb
  END
);--> statement-breakpoint
ALTER TABLE "sf_events" ALTER COLUMN "price_rules" SET DEFAULT '{"time":[],"sold":null}'::jsonb;--> statement-breakpoint
ALTER TABLE "sf_event_ticket_tiers" ALTER COLUMN "price_rules" SET DEFAULT '{"time":[],"sold":null}'::jsonb;
