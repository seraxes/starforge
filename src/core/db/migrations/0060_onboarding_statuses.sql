CREATE TABLE "sf_onboarding_identity_facts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"status_id" text DEFAULT '' NOT NULL,
	"driver_code" text,
	"phone" text DEFAULT '' NOT NULL,
	"station_id" text DEFAULT '' NOT NULL,
	"home_run_allow" boolean DEFAULT false NOT NULL,
	"home_run_free_km" integer DEFAULT 0 NOT NULL,
	"trainer" boolean DEFAULT false NOT NULL,
	"clearquote" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_onboarding_statuses" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"bookable" boolean DEFAULT false NOT NULL,
	"form_definition_id" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sf_onboarding_identity_driver_code_uidx" ON "sf_onboarding_identity_facts" USING btree ("driver_code");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_identity_status_idx" ON "sf_onboarding_identity_facts" USING btree ("status_id");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_identity_station_idx" ON "sf_onboarding_identity_facts" USING btree ("station_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "sf_onboarding_statuses_key_uidx" ON "sf_onboarding_statuses" USING btree ("key");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_statuses_sort_idx" ON "sf_onboarding_statuses" USING btree ("sort_order");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_statuses_bookable_idx" ON "sf_onboarding_statuses" USING btree ("bookable");
