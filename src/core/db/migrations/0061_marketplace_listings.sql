CREATE TABLE "sf_marketplace_listings" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_user_id" text NOT NULL,
	"category_id" text DEFAULT '' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price_minor" integer,
	"condition" text DEFAULT 'used' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"area_label" text DEFAULT '' NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"expires_at" timestamp with time zone,
	"sold_to_user_id" text,
	"media_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sf_marketplace_listings_seller_idx" ON "sf_marketplace_listings" USING btree ("seller_user_id");
--> statement-breakpoint
CREATE INDEX "sf_marketplace_listings_category_idx" ON "sf_marketplace_listings" USING btree ("category_id");
--> statement-breakpoint
CREATE INDEX "sf_marketplace_listings_status_idx" ON "sf_marketplace_listings" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "sf_marketplace_listings_expires_idx" ON "sf_marketplace_listings" USING btree ("expires_at");
