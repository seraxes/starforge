CREATE TABLE "sf_onboarding_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"color" text DEFAULT '' NOT NULL,
	"todo" boolean DEFAULT false NOT NULL,
	"fade" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sf_onboarding_tags_sort_idx" ON "sf_onboarding_tags" USING btree ("sort_order");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_tags_label_idx" ON "sf_onboarding_tags" USING btree ("label");
