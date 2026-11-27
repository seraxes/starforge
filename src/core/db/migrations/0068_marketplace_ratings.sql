CREATE TABLE "sf_marketplace_ratings" (
	"id" text PRIMARY KEY NOT NULL,
	"from_user_id" text NOT NULL,
	"to_user_id" text NOT NULL,
	"listing_id" text NOT NULL,
	"direction" text NOT NULL,
	"score" integer NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sf_marketplace_ratings_from_listing_direction_uidx" ON "sf_marketplace_ratings" USING btree ("from_user_id","listing_id","direction");
--> statement-breakpoint
CREATE INDEX "sf_marketplace_ratings_to_idx" ON "sf_marketplace_ratings" USING btree ("to_user_id");
--> statement-breakpoint
CREATE INDEX "sf_marketplace_ratings_listing_idx" ON "sf_marketplace_ratings" USING btree ("listing_id");
--> statement-breakpoint
CREATE INDEX "sf_marketplace_ratings_from_idx" ON "sf_marketplace_ratings" USING btree ("from_user_id");
--> statement-breakpoint
CREATE INDEX "sf_marketplace_ratings_hidden_idx" ON "sf_marketplace_ratings" USING btree ("hidden");
