CREATE TABLE "sf_marketplace_inquiries" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"buyer_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sf_marketplace_inquiries_listing_buyer_uidx" ON "sf_marketplace_inquiries" USING btree ("listing_id","buyer_user_id");
--> statement-breakpoint
CREATE INDEX "sf_marketplace_inquiries_listing_idx" ON "sf_marketplace_inquiries" USING btree ("listing_id");
--> statement-breakpoint
CREATE INDEX "sf_marketplace_inquiries_buyer_idx" ON "sf_marketplace_inquiries" USING btree ("buyer_user_id");
--> statement-breakpoint
CREATE TABLE "sf_marketplace_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"inquiry_id" text NOT NULL,
	"author_user_id" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"kind" text DEFAULT 'text' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sf_marketplace_messages_inquiry_idx" ON "sf_marketplace_messages" USING btree ("inquiry_id");
--> statement-breakpoint
CREATE INDEX "sf_marketplace_messages_author_idx" ON "sf_marketplace_messages" USING btree ("author_user_id");
--> statement-breakpoint
CREATE TABLE "sf_marketplace_offers" (
	"id" text PRIMARY KEY NOT NULL,
	"inquiry_id" text NOT NULL,
	"amount_minor" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sf_marketplace_offers_inquiry_idx" ON "sf_marketplace_offers" USING btree ("inquiry_id");
--> statement-breakpoint
CREATE INDEX "sf_marketplace_offers_status_idx" ON "sf_marketplace_offers" USING btree ("status");
