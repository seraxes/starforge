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
CREATE UNIQUE INDEX "sf_onboarding_document_slots_user_kind_uidx" ON "sf_onboarding_document_slots" USING btree ("user_id","kind");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_document_slots_user_idx" ON "sf_onboarding_document_slots" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_document_slots_kind_idx" ON "sf_onboarding_document_slots" USING btree ("kind");
--> statement-breakpoint
CREATE INDEX "sf_onboarding_document_slots_valid_until_idx" ON "sf_onboarding_document_slots" USING btree ("valid_until");
