CREATE TABLE "sf_onboarding_training_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"trainee_user_id" text NOT NULL,
	"instructor_user_id" text DEFAULT '' NOT NULL,
	"report_date" text DEFAULT '' NOT NULL,
	"depot_key" text DEFAULT '' NOT NULL,
	"depot_label" text DEFAULT '' NOT NULL,
	"training_day" text DEFAULT '' NOT NULL,
	"plate" text DEFAULT '' NOT NULL,
	"rounds" integer DEFAULT 0 NOT NULL,
	"drove" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"passed" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"media_id" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_onboarding_training_save_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"actor_user_id" text DEFAULT '' NOT NULL,
	"action" text DEFAULT 'save' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_onboarding_qualifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"qualified_date" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_onboarding_quiz_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"form_definition_id" text DEFAULT '' NOT NULL,
	"attempt_id" text DEFAULT '' NOT NULL,
	"passed" boolean DEFAULT false NOT NULL,
	"result_note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_onboarding_trainers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"linked_user_id" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_onboarding_trainer_slots" (
	"id" text PRIMARY KEY NOT NULL,
	"instructor_user_id" text DEFAULT '' NOT NULL,
	"slot_date" text DEFAULT '' NOT NULL,
	"slot_index" integer DEFAULT 1 NOT NULL,
	"start_time" text DEFAULT '' NOT NULL,
	"location_code" text DEFAULT '' NOT NULL,
	"trainee_user_id" text DEFAULT '' NOT NULL,
	"kind" text DEFAULT 'ridealong' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sf_onboarding_training_reports_trainee_idx" ON "sf_onboarding_training_reports" USING btree ("trainee_user_id");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_training_reports_instructor_idx" ON "sf_onboarding_training_reports" USING btree ("instructor_user_id");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_training_reports_date_idx" ON "sf_onboarding_training_reports" USING btree ("report_date");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_training_reports_status_idx" ON "sf_onboarding_training_reports" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_training_reports_passed_idx" ON "sf_onboarding_training_reports" USING btree ("passed");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_training_save_logs_report_idx" ON "sf_onboarding_training_save_logs" USING btree ("report_id");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_training_save_logs_actor_idx" ON "sf_onboarding_training_save_logs" USING btree ("actor_user_id");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_training_save_logs_created_idx" ON "sf_onboarding_training_save_logs" USING btree ("created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "sf_onboarding_qualifications_user_source_uidx" ON "sf_onboarding_qualifications" USING btree ("user_id","source");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_qualifications_user_idx" ON "sf_onboarding_qualifications" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_qualifications_source_idx" ON "sf_onboarding_qualifications" USING btree ("source");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_quiz_attempts_user_idx" ON "sf_onboarding_quiz_attempts" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_quiz_attempts_form_idx" ON "sf_onboarding_quiz_attempts" USING btree ("form_definition_id");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_quiz_attempts_attempt_idx" ON "sf_onboarding_quiz_attempts" USING btree ("attempt_id");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_trainers_linked_idx" ON "sf_onboarding_trainers" USING btree ("linked_user_id");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_trainers_name_idx" ON "sf_onboarding_trainers" USING btree ("name");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_trainer_slots_instructor_idx" ON "sf_onboarding_trainer_slots" USING btree ("instructor_user_id");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_trainer_slots_date_idx" ON "sf_onboarding_trainer_slots" USING btree ("slot_date");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_trainer_slots_trainee_idx" ON "sf_onboarding_trainer_slots" USING btree ("trainee_user_id");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_trainer_slots_status_idx" ON "sf_onboarding_trainer_slots" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX "sf_onboarding_trainer_slots_instructor_date_index_uidx" ON "sf_onboarding_trainer_slots" USING btree ("instructor_user_id","slot_date","slot_index");
