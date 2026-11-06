CREATE TABLE "sf_event_ticket_tiers" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"title" text DEFAULT 'Ticket' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"kind" text DEFAULT 'general' NOT NULL,
	"capacity" integer,
	"price_label" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sf_event_ticket_tiers" ADD CONSTRAINT "sf_event_ticket_tiers_event_id_sf_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."sf_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sf_event_ticket_tiers_event_id_idx" ON "sf_event_ticket_tiers" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "sf_event_ticket_tiers_sort_idx" ON "sf_event_ticket_tiers" USING btree ("event_id","sort_order");--> statement-breakpoint
ALTER TABLE "sf_event_registrations" ADD COLUMN "ticket_tier_id" text;--> statement-breakpoint
ALTER TABLE "sf_event_registrations" ADD CONSTRAINT "sf_event_registrations_ticket_tier_id_sf_event_ticket_tiers_id_fk" FOREIGN KEY ("ticket_tier_id") REFERENCES "public"."sf_event_ticket_tiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sf_event_registrations_tier_id_idx" ON "sf_event_registrations" USING btree ("ticket_tier_id");
