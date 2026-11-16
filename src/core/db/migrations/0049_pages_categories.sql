CREATE TABLE "sf_pages_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text DEFAULT 'Untitled category' NOT NULL,
	"slug" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sf_pages_categories_slug_uidx" ON "sf_pages_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "sf_pages_categories_sort_idx" ON "sf_pages_categories" USING btree ("sort_order");--> statement-breakpoint
ALTER TABLE "sf_pages" ADD COLUMN "category_id" text;--> statement-breakpoint
ALTER TABLE "sf_pages" ADD CONSTRAINT "sf_pages_category_id_sf_pages_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."sf_pages_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sf_pages_category_id_idx" ON "sf_pages" USING btree ("category_id");--> statement-breakpoint
ALTER TABLE "sf_pages_versions" ADD COLUMN "category_id" text DEFAULT '' NOT NULL;
