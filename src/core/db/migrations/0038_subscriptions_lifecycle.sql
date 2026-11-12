ALTER TABLE "sf_sub_plans" ADD COLUMN IF NOT EXISTS "trial_duration_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_sub_plans" ADD COLUMN IF NOT EXISTS "trial_price" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_sub_plans" ADD COLUMN IF NOT EXISTS "trial_once" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_sub_plans" ADD COLUMN IF NOT EXISTS "lifetime" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_sub_plans" ADD COLUMN IF NOT EXISTS "fixed_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sf_sub_plans" ADD COLUMN IF NOT EXISTS "max_active" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_sub_plans" ADD COLUMN IF NOT EXISTS "form_definition_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_sub_plans" ADD COLUMN IF NOT EXISTS "early_renew_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_sub_plans" ADD COLUMN IF NOT EXISTS "early_renew_price" integer;--> statement-breakpoint
ALTER TABLE "sf_sub_plans" ADD COLUMN IF NOT EXISTS "upgrade_target_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_sub_plans" ADD COLUMN IF NOT EXISTS "grace_hours" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_sub_plans" ADD COLUMN IF NOT EXISTS "seat_limit" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_sub_plans" ADD COLUMN IF NOT EXISTS "recurring_supported" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_sub_plans" ADD COLUMN IF NOT EXISTS "image_media_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_sub_periods" ADD COLUMN IF NOT EXISTS "cancel_at_period_end" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_sub_periods" ADD COLUMN IF NOT EXISTS "auto_renew" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_sub_periods" ADD COLUMN IF NOT EXISTS "payments_recurring_id" text;--> statement-breakpoint
ALTER TABLE "sf_sub_periods" ADD COLUMN IF NOT EXISTS "is_trial" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_sub_periods" ADD COLUMN IF NOT EXISTS "parent_period_id" text;--> statement-breakpoint
ALTER TABLE "sf_sub_periods" ADD COLUMN IF NOT EXISTS "seat_role" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_sub_periods" ADD COLUMN IF NOT EXISTS "reminder_expiring_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sf_sub_periods" ADD COLUMN IF NOT EXISTS "reminder_trial_sent_at" timestamp with time zone;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sf_sub_seats" (
	"id" text PRIMARY KEY NOT NULL,
	"period_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sf_sub_seats" ADD CONSTRAINT "sf_sub_seats_period_id_sf_sub_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."sf_sub_periods"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sf_sub_seats_period_id_idx" ON "sf_sub_seats" USING btree ("period_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sf_sub_seats_user_id_idx" ON "sf_sub_seats" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sf_sub_seats_period_user_uidx" ON "sf_sub_seats" USING btree ("period_id","user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sf_pay_recurring" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"method" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"provider_ref" text DEFAULT '' NOT NULL,
	"source_module" text DEFAULT '' NOT NULL,
	"source_type" text DEFAULT '' NOT NULL,
	"source_id" text DEFAULT '' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"next_charge_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sf_pay_recurring_user_id_idx" ON "sf_pay_recurring" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sf_pay_recurring_status_idx" ON "sf_pay_recurring" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sf_pay_recurring_source_idx" ON "sf_pay_recurring" USING btree ("source_module","source_type","source_id");
