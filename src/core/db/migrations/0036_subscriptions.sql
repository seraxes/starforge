CREATE TABLE "sf_sub_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"subject" text DEFAULT 'membership' NOT NULL,
	"audience" text DEFAULT '' NOT NULL,
	"title" text DEFAULT 'Plan' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"billing_period" text DEFAULT 'month' NOT NULL,
	"entitlement_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"group_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_module" text DEFAULT '' NOT NULL,
	"source_type" text DEFAULT '' NOT NULL,
	"source_id" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sf_sub_plans_subject_idx" ON "sf_sub_plans" USING btree ("subject");
--> statement-breakpoint
CREATE INDEX "sf_sub_plans_active_idx" ON "sf_sub_plans" USING btree ("active");
--> statement-breakpoint
CREATE INDEX "sf_sub_plans_sort_idx" ON "sf_sub_plans" USING btree ("sort_order");
--> statement-breakpoint
CREATE TABLE "sf_sub_periods" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"order_id" text,
	"subject" text DEFAULT 'membership' NOT NULL,
	"audience" text DEFAULT '' NOT NULL,
	"billing_period" text DEFAULT 'month' NOT NULL,
	"entitlement_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"group_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_module" text DEFAULT '' NOT NULL,
	"source_type" text DEFAULT '' NOT NULL,
	"source_id" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'purchase' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sf_sub_periods" ADD CONSTRAINT "sf_sub_periods_plan_id_sf_sub_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."sf_sub_plans"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "sf_sub_periods_user_id_idx" ON "sf_sub_periods" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "sf_sub_periods_plan_id_idx" ON "sf_sub_periods" USING btree ("plan_id");
--> statement-breakpoint
CREATE INDEX "sf_sub_periods_status_idx" ON "sf_sub_periods" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "sf_sub_periods_ends_at_idx" ON "sf_sub_periods" USING btree ("ends_at");
--> statement-breakpoint
CREATE INDEX "sf_sub_periods_order_id_idx" ON "sf_sub_periods" USING btree ("order_id");
--> statement-breakpoint
CREATE INDEX "sf_sub_periods_user_status_idx" ON "sf_sub_periods" USING btree ("user_id","status");
