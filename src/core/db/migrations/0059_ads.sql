CREATE TABLE "sf_ads_packages" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"credit_grant" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sf_ads_packages_active_idx" ON "sf_ads_packages" USING btree ("active");
--> statement-breakpoint
CREATE INDEX "sf_ads_packages_sort_idx" ON "sf_ads_packages" USING btree ("sort_order");
--> statement-breakpoint
CREATE TABLE "sf_ads_placements" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"key" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sf_ads_placements_key_uidx" ON "sf_ads_placements" USING btree ("key");
--> statement-breakpoint
CREATE INDEX "sf_ads_placements_enabled_idx" ON "sf_ads_placements" USING btree ("enabled");
--> statement-breakpoint
CREATE TABLE "sf_ads_credits" (
	"id" text PRIMARY KEY NOT NULL,
	"buyer_user_id" text NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sf_ads_credits_buyer_uidx" ON "sf_ads_credits" USING btree ("buyer_user_id");
--> statement-breakpoint
CREATE INDEX "sf_ads_credits_buyer_idx" ON "sf_ads_credits" USING btree ("buyer_user_id");
--> statement-breakpoint
CREATE TABLE "sf_ads_campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"buyer_user_id" text DEFAULT '' NOT NULL,
	"package_id" text NOT NULL,
	"placement_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"status" text DEFAULT 'draft' NOT NULL,
	"creative_media_id" text DEFAULT '' NOT NULL,
	"copy_title" text DEFAULT '' NOT NULL,
	"copy_body" text DEFAULT '' NOT NULL,
	"social_post_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sf_ads_campaigns" ADD CONSTRAINT "sf_ads_campaigns_package_id_sf_ads_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."sf_ads_packages"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "sf_ads_campaigns_buyer_idx" ON "sf_ads_campaigns" USING btree ("buyer_user_id");
--> statement-breakpoint
CREATE INDEX "sf_ads_campaigns_package_idx" ON "sf_ads_campaigns" USING btree ("package_id");
--> statement-breakpoint
CREATE INDEX "sf_ads_campaigns_status_idx" ON "sf_ads_campaigns" USING btree ("status");
