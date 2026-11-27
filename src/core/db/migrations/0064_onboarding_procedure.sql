CREATE TABLE "sf_onboarding_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"event_date" text DEFAULT '' NOT NULL,
	"event_time" text DEFAULT '' NOT NULL,
	"courier_name" text DEFAULT '' NOT NULL,
	"courier_phone" text DEFAULT '' NOT NULL,
	"meeting_mode" text DEFAULT 'onsite' NOT NULL,
	"exam_url" text DEFAULT '' NOT NULL,
	"applicant_response" text DEFAULT '' NOT NULL,
	"outcome" text DEFAULT '' NOT NULL,
	"outcome_actor_user_id" text DEFAULT '' NOT NULL,
	"outcome_at" timestamp with time zone,
	"also_trial" boolean DEFAULT false NOT NULL,
	"requested_dates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"requested_submission_id" text DEFAULT '' NOT NULL,
	"due_notice" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_onboarding_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"author_user_id" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_onboarding_follow_ups" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"reminder_status" text DEFAULT 'open' NOT NULL,
	"reminder_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_onboarding_calls" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"call_at" timestamp with time zone,
	"done" boolean DEFAULT false NOT NULL,
	"due_notice" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_onboarding_mail_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"channel" text NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"to_email" text DEFAULT '' NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sender_user_id" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sf_onboarding_events_user_idx" ON "sf_onboarding_events" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_events_kind_idx" ON "sf_onboarding_events" USING btree ("kind");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_events_date_idx" ON "sf_onboarding_events" USING btree ("event_date");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_events_outcome_idx" ON "sf_onboarding_events" USING btree ("outcome");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_notes_user_idx" ON "sf_onboarding_notes" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_notes_created_idx" ON "sf_onboarding_notes" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_follow_ups_user_idx" ON "sf_onboarding_follow_ups" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_follow_ups_reminder_idx" ON "sf_onboarding_follow_ups" USING btree ("reminder_status");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_calls_user_idx" ON "sf_onboarding_calls" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_calls_call_at_idx" ON "sf_onboarding_calls" USING btree ("call_at");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_mail_logs_user_idx" ON "sf_onboarding_mail_logs" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_mail_logs_channel_idx" ON "sf_onboarding_mail_logs" USING btree ("channel");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_mail_logs_sent_idx" ON "sf_onboarding_mail_logs" USING btree ("sent_at");
