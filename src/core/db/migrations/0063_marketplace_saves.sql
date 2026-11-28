CREATE TABLE "sf_marketplace_saves" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"listing_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sf_marketplace_saves_user_listing_uidx" ON "sf_marketplace_saves" USING btree ("user_id","listing_id");
--> statement-breakpoint
CREATE INDEX "sf_marketplace_saves_user_idx" ON "sf_marketplace_saves" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "sf_marketplace_saves_listing_idx" ON "sf_marketplace_saves" USING btree ("listing_id");
