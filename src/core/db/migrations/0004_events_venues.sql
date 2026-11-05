CREATE TABLE "sf_venues" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT 'Untitled venue' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"cover_media_id" text,
	"access_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_events" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text DEFAULT 'Untitled event' NOT NULL,
	"slug" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"venue_id" text,
	"description" text DEFAULT '' NOT NULL,
	"cover_media_id" text,
	"gallery_media_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"capacity" integer,
	"access_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sf_events" ADD CONSTRAINT "sf_events_venue_id_sf_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."sf_venues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sf_venues_name_idx" ON "sf_venues" USING btree ("name");--> statement-breakpoint
CREATE INDEX "sf_events_status_idx" ON "sf_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sf_events_starts_at_idx" ON "sf_events" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "sf_events_venue_id_idx" ON "sf_events" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "sf_events_slug_idx" ON "sf_events" USING btree ("slug");
