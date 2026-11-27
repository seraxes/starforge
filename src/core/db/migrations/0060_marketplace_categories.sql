CREATE TABLE "sf_marketplace_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text,
	"parent_id" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sf_marketplace_categories_slug_idx" ON "sf_marketplace_categories" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX "sf_marketplace_categories_sort_idx" ON "sf_marketplace_categories" USING btree ("sort_order");
--> statement-breakpoint
CREATE INDEX "sf_marketplace_categories_parent_idx" ON "sf_marketplace_categories" USING btree ("parent_id");
--> statement-breakpoint
CREATE INDEX "sf_marketplace_categories_enabled_idx" ON "sf_marketplace_categories" USING btree ("enabled");
