CREATE TABLE "sf_onboarding_depots" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sf_onboarding_depots_sort_idx" ON "sf_onboarding_depots" USING btree ("sort_order");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_depots_name_idx" ON "sf_onboarding_depots" USING btree ("name");
