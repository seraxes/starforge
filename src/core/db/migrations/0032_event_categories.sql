CREATE TABLE "sf_event_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text DEFAULT 'Untitled category' NOT NULL,
	"slug" text,
	"description" text DEFAULT '' NOT NULL,
	"registration_form_id" text DEFAULT '' NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"access_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sf_event_categories_slug_idx" ON "sf_event_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "sf_event_categories_sort_idx" ON "sf_event_categories" USING btree ("sort_order");--> statement-breakpoint
ALTER TABLE "sf_events" ADD COLUMN "category_id" text;--> statement-breakpoint
ALTER TABLE "sf_events" ADD COLUMN "registration_form_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_events" ADD CONSTRAINT "sf_events_category_id_sf_event_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."sf_event_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sf_events_category_id_idx" ON "sf_events" USING btree ("category_id");
