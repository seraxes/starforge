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
CREATE TABLE "sf_ads_credits" (
	"id" text PRIMARY KEY NOT NULL,
	"buyer_user_id" text NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "sf_ads_placements" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"key" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_documents_links" (
	"id" text PRIMARY KEY NOT NULL,
	"subject_kind" text NOT NULL,
	"subject_id" text NOT NULL,
	"template_id" text DEFAULT '' NOT NULL,
	"media_id" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"status" text DEFAULT '' NOT NULL,
	"provider_id" text DEFAULT '' NOT NULL,
	"envelope_id" text DEFAULT '' NOT NULL,
	"generation" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_documents_signature_receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"envelope_id" text DEFAULT '' NOT NULL,
	"link_id" text DEFAULT '' NOT NULL,
	"status" text DEFAULT '' NOT NULL,
	"media_id" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_documents_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"subject_kind" text NOT NULL,
	"render_source" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_marketplace_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text,
	"parent_id" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_marketplace_inquiries" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"buyer_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_marketplace_listings" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_user_id" text NOT NULL,
	"category_id" text DEFAULT '' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price_minor" integer,
	"condition" text DEFAULT 'used' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"area_label" text DEFAULT '' NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"expires_at" timestamp with time zone,
	"sold_to_user_id" text,
	"media_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
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
CREATE TABLE "sf_marketplace_offers" (
	"id" text PRIMARY KEY NOT NULL,
	"inquiry_id" text NOT NULL,
	"amount_minor" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_marketplace_ratings" (
	"id" text PRIMARY KEY NOT NULL,
	"from_user_id" text NOT NULL,
	"to_user_id" text NOT NULL,
	"listing_id" text NOT NULL,
	"direction" text NOT NULL,
	"score" integer NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_marketplace_saves" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"listing_id" text NOT NULL,
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
CREATE TABLE "sf_onboarding_dashboard_tiles" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"icon" text DEFAULT '' NOT NULL,
	"url" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"status_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"staff_only" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_onboarding_depots" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_onboarding_document_slots" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"media_id" text DEFAULT '' NOT NULL,
	"valid_until" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_onboarding_event_types" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"template_id" text DEFAULT '' NOT NULL,
	"form_definition_id" text DEFAULT '' NOT NULL,
	"date_field_names" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active_status_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completed_status_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "sf_onboarding_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"author_user_id" text DEFAULT '' NOT NULL,
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
CREATE TABLE "sf_onboarding_statuses" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"phase" text DEFAULT 'recruiting' NOT NULL,
	"display_label" text DEFAULT '' NOT NULL,
	"action_chip" text DEFAULT '' NOT NULL,
	"next_step_message" text DEFAULT '' NOT NULL,
	"page_id" text DEFAULT '' NOT NULL,
	"bookable" boolean DEFAULT false NOT NULL,
	"form_definition_id" text DEFAULT '' NOT NULL,
	"reminder_template_id" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "sf_onboarding_trainers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"linked_user_id" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "sf_social_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"host_module" text NOT NULL,
	"host_id" text NOT NULL,
	"post_id" text NOT NULL,
	"host_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_social_mutes" (
	"id" text PRIMARY KEY NOT NULL,
	"muter_user_id" text NOT NULL,
	"muted_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_social_post_hides" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"post_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sf_event_categories" ADD COLUMN "parent_id" text;--> statement-breakpoint
ALTER TABLE "sf_social_posts" ADD COLUMN "pending_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_ads_campaigns" ADD CONSTRAINT "sf_ads_campaigns_package_id_sf_ads_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."sf_ads_packages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sf_ads_campaigns_buyer_idx" ON "sf_ads_campaigns" USING btree ("buyer_user_id");--> statement-breakpoint
CREATE INDEX "sf_ads_campaigns_package_idx" ON "sf_ads_campaigns" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "sf_ads_campaigns_status_idx" ON "sf_ads_campaigns" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "sf_ads_credits_buyer_uidx" ON "sf_ads_credits" USING btree ("buyer_user_id");--> statement-breakpoint
CREATE INDEX "sf_ads_credits_buyer_idx" ON "sf_ads_credits" USING btree ("buyer_user_id");--> statement-breakpoint
CREATE INDEX "sf_ads_packages_active_idx" ON "sf_ads_packages" USING btree ("active");--> statement-breakpoint
CREATE INDEX "sf_ads_packages_sort_idx" ON "sf_ads_packages" USING btree ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "sf_ads_placements_key_uidx" ON "sf_ads_placements" USING btree ("key");--> statement-breakpoint
CREATE INDEX "sf_ads_placements_enabled_idx" ON "sf_ads_placements" USING btree ("enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "sf_documents_links_subject_template_gen_uidx" ON "sf_documents_links" USING btree ("subject_kind","subject_id","template_id","generation") WHERE "sf_documents_links"."template_id" <> '';--> statement-breakpoint
CREATE UNIQUE INDEX "sf_documents_links_subject_media_uidx" ON "sf_documents_links" USING btree ("subject_kind","subject_id","media_id") WHERE "sf_documents_links"."template_id" = '';--> statement-breakpoint
CREATE INDEX "sf_documents_links_subject_idx" ON "sf_documents_links" USING btree ("subject_kind","subject_id");--> statement-breakpoint
CREATE INDEX "sf_documents_links_media_idx" ON "sf_documents_links" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "sf_documents_links_envelope_idx" ON "sf_documents_links" USING btree ("provider_id","envelope_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sf_documents_signature_receipts_event_uidx" ON "sf_documents_signature_receipts" USING btree ("provider_id","provider_event_id");--> statement-breakpoint
CREATE INDEX "sf_documents_signature_receipts_envelope_idx" ON "sf_documents_signature_receipts" USING btree ("provider_id","envelope_id");--> statement-breakpoint
CREATE INDEX "sf_documents_templates_subject_idx" ON "sf_documents_templates" USING btree ("subject_kind");--> statement-breakpoint
CREATE INDEX "sf_documents_templates_enabled_idx" ON "sf_documents_templates" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "sf_marketplace_categories_slug_idx" ON "sf_marketplace_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "sf_marketplace_categories_sort_idx" ON "sf_marketplace_categories" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "sf_marketplace_categories_parent_idx" ON "sf_marketplace_categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "sf_marketplace_categories_enabled_idx" ON "sf_marketplace_categories" USING btree ("enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "sf_marketplace_inquiries_listing_buyer_uidx" ON "sf_marketplace_inquiries" USING btree ("listing_id","buyer_user_id");--> statement-breakpoint
CREATE INDEX "sf_marketplace_inquiries_listing_idx" ON "sf_marketplace_inquiries" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "sf_marketplace_inquiries_buyer_idx" ON "sf_marketplace_inquiries" USING btree ("buyer_user_id");--> statement-breakpoint
CREATE INDEX "sf_marketplace_listings_seller_idx" ON "sf_marketplace_listings" USING btree ("seller_user_id");--> statement-breakpoint
CREATE INDEX "sf_marketplace_listings_category_idx" ON "sf_marketplace_listings" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "sf_marketplace_listings_status_idx" ON "sf_marketplace_listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sf_marketplace_listings_expires_idx" ON "sf_marketplace_listings" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sf_marketplace_messages_inquiry_idx" ON "sf_marketplace_messages" USING btree ("inquiry_id");--> statement-breakpoint
CREATE INDEX "sf_marketplace_messages_author_idx" ON "sf_marketplace_messages" USING btree ("author_user_id");--> statement-breakpoint
CREATE INDEX "sf_marketplace_offers_inquiry_idx" ON "sf_marketplace_offers" USING btree ("inquiry_id");--> statement-breakpoint
CREATE INDEX "sf_marketplace_offers_status_idx" ON "sf_marketplace_offers" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "sf_marketplace_ratings_from_listing_direction_uidx" ON "sf_marketplace_ratings" USING btree ("from_user_id","listing_id","direction");--> statement-breakpoint
CREATE INDEX "sf_marketplace_ratings_to_idx" ON "sf_marketplace_ratings" USING btree ("to_user_id");--> statement-breakpoint
CREATE INDEX "sf_marketplace_ratings_listing_idx" ON "sf_marketplace_ratings" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "sf_marketplace_ratings_from_idx" ON "sf_marketplace_ratings" USING btree ("from_user_id");--> statement-breakpoint
CREATE INDEX "sf_marketplace_ratings_hidden_idx" ON "sf_marketplace_ratings" USING btree ("hidden");--> statement-breakpoint
CREATE UNIQUE INDEX "sf_marketplace_saves_user_listing_uidx" ON "sf_marketplace_saves" USING btree ("user_id","listing_id");--> statement-breakpoint
CREATE INDEX "sf_marketplace_saves_user_idx" ON "sf_marketplace_saves" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sf_marketplace_saves_listing_idx" ON "sf_marketplace_saves" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "sf_onboarding_calls_user_idx" ON "sf_onboarding_calls" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sf_onboarding_calls_call_at_idx" ON "sf_onboarding_calls" USING btree ("call_at");--> statement-breakpoint
CREATE INDEX "sf_onboarding_dashboard_tiles_sort_idx" ON "sf_onboarding_dashboard_tiles" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "sf_onboarding_dashboard_tiles_published_idx" ON "sf_onboarding_dashboard_tiles" USING btree ("published");--> statement-breakpoint
CREATE INDEX "sf_onboarding_depots_sort_idx" ON "sf_onboarding_depots" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "sf_onboarding_depots_name_idx" ON "sf_onboarding_depots" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "sf_onboarding_document_slots_user_kind_uidx" ON "sf_onboarding_document_slots" USING btree ("user_id","kind");--> statement-breakpoint
CREATE INDEX "sf_onboarding_document_slots_user_idx" ON "sf_onboarding_document_slots" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sf_onboarding_document_slots_kind_idx" ON "sf_onboarding_document_slots" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "sf_onboarding_document_slots_valid_until_idx" ON "sf_onboarding_document_slots" USING btree ("valid_until");--> statement-breakpoint
CREATE UNIQUE INDEX "sf_onboarding_event_types_key_uidx" ON "sf_onboarding_event_types" USING btree ("key");--> statement-breakpoint
CREATE INDEX "sf_onboarding_event_types_sort_idx" ON "sf_onboarding_event_types" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "sf_onboarding_event_types_enabled_idx" ON "sf_onboarding_event_types" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "sf_onboarding_events_user_idx" ON "sf_onboarding_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sf_onboarding_events_kind_idx" ON "sf_onboarding_events" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "sf_onboarding_events_date_idx" ON "sf_onboarding_events" USING btree ("event_date");--> statement-breakpoint
CREATE INDEX "sf_onboarding_events_outcome_idx" ON "sf_onboarding_events" USING btree ("outcome");--> statement-breakpoint
CREATE INDEX "sf_onboarding_follow_ups_user_idx" ON "sf_onboarding_follow_ups" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sf_onboarding_follow_ups_reminder_idx" ON "sf_onboarding_follow_ups" USING btree ("reminder_status");--> statement-breakpoint
CREATE UNIQUE INDEX "sf_onboarding_identity_driver_code_uidx" ON "sf_onboarding_identity_facts" USING btree ("driver_code");--> statement-breakpoint
CREATE INDEX "sf_onboarding_identity_status_idx" ON "sf_onboarding_identity_facts" USING btree ("status_id");--> statement-breakpoint
CREATE INDEX "sf_onboarding_identity_station_idx" ON "sf_onboarding_identity_facts" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "sf_onboarding_mail_logs_user_idx" ON "sf_onboarding_mail_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sf_onboarding_mail_logs_channel_idx" ON "sf_onboarding_mail_logs" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "sf_onboarding_mail_logs_sent_idx" ON "sf_onboarding_mail_logs" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "sf_onboarding_notes_user_idx" ON "sf_onboarding_notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sf_onboarding_notes_created_idx" ON "sf_onboarding_notes" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sf_onboarding_qualifications_user_source_uidx" ON "sf_onboarding_qualifications" USING btree ("user_id","source");--> statement-breakpoint
CREATE INDEX "sf_onboarding_qualifications_user_idx" ON "sf_onboarding_qualifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sf_onboarding_qualifications_source_idx" ON "sf_onboarding_qualifications" USING btree ("source");--> statement-breakpoint
CREATE INDEX "sf_onboarding_quiz_attempts_user_idx" ON "sf_onboarding_quiz_attempts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sf_onboarding_quiz_attempts_form_idx" ON "sf_onboarding_quiz_attempts" USING btree ("form_definition_id");--> statement-breakpoint
CREATE INDEX "sf_onboarding_quiz_attempts_attempt_idx" ON "sf_onboarding_quiz_attempts" USING btree ("attempt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sf_onboarding_statuses_key_uidx" ON "sf_onboarding_statuses" USING btree ("key");--> statement-breakpoint
CREATE INDEX "sf_onboarding_statuses_sort_idx" ON "sf_onboarding_statuses" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "sf_onboarding_statuses_bookable_idx" ON "sf_onboarding_statuses" USING btree ("bookable");--> statement-breakpoint
CREATE INDEX "sf_onboarding_statuses_phase_idx" ON "sf_onboarding_statuses" USING btree ("phase");--> statement-breakpoint
CREATE INDEX "sf_onboarding_tags_sort_idx" ON "sf_onboarding_tags" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "sf_onboarding_tags_label_idx" ON "sf_onboarding_tags" USING btree ("label");--> statement-breakpoint
CREATE INDEX "sf_onboarding_trainer_slots_instructor_idx" ON "sf_onboarding_trainer_slots" USING btree ("instructor_user_id");--> statement-breakpoint
CREATE INDEX "sf_onboarding_trainer_slots_date_idx" ON "sf_onboarding_trainer_slots" USING btree ("slot_date");--> statement-breakpoint
CREATE INDEX "sf_onboarding_trainer_slots_trainee_idx" ON "sf_onboarding_trainer_slots" USING btree ("trainee_user_id");--> statement-breakpoint
CREATE INDEX "sf_onboarding_trainer_slots_status_idx" ON "sf_onboarding_trainer_slots" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "sf_onboarding_trainer_slots_instructor_date_index_uidx" ON "sf_onboarding_trainer_slots" USING btree ("instructor_user_id","slot_date","slot_index");--> statement-breakpoint
CREATE INDEX "sf_onboarding_trainers_linked_idx" ON "sf_onboarding_trainers" USING btree ("linked_user_id");--> statement-breakpoint
CREATE INDEX "sf_onboarding_trainers_name_idx" ON "sf_onboarding_trainers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "sf_onboarding_training_reports_trainee_idx" ON "sf_onboarding_training_reports" USING btree ("trainee_user_id");--> statement-breakpoint
CREATE INDEX "sf_onboarding_training_reports_instructor_idx" ON "sf_onboarding_training_reports" USING btree ("instructor_user_id");--> statement-breakpoint
CREATE INDEX "sf_onboarding_training_reports_date_idx" ON "sf_onboarding_training_reports" USING btree ("report_date");--> statement-breakpoint
CREATE INDEX "sf_onboarding_training_reports_status_idx" ON "sf_onboarding_training_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sf_onboarding_training_reports_passed_idx" ON "sf_onboarding_training_reports" USING btree ("passed");--> statement-breakpoint
CREATE INDEX "sf_onboarding_training_save_logs_report_idx" ON "sf_onboarding_training_save_logs" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "sf_onboarding_training_save_logs_actor_idx" ON "sf_onboarding_training_save_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "sf_onboarding_training_save_logs_created_idx" ON "sf_onboarding_training_save_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sf_social_conversations_host_uidx" ON "sf_social_conversations" USING btree ("host_module","host_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sf_social_conversations_post_uidx" ON "sf_social_conversations" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "sf_social_conversations_created_idx" ON "sf_social_conversations" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sf_social_mutes_pair_uidx" ON "sf_social_mutes" USING btree ("muter_user_id","muted_user_id");--> statement-breakpoint
CREATE INDEX "sf_social_mutes_muter_idx" ON "sf_social_mutes" USING btree ("muter_user_id");--> statement-breakpoint
CREATE INDEX "sf_social_mutes_muted_idx" ON "sf_social_mutes" USING btree ("muted_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sf_social_post_hides_user_post_uidx" ON "sf_social_post_hides" USING btree ("user_id","post_id");--> statement-breakpoint
CREATE INDEX "sf_social_post_hides_user_idx" ON "sf_social_post_hides" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sf_social_post_hides_post_idx" ON "sf_social_post_hides" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "sf_event_categories_parent_idx" ON "sf_event_categories" USING btree ("parent_id");