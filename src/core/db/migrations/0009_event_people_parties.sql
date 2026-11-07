ALTER TABLE "sf_events" ADD COLUMN "manager_user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_events" ADD COLUMN "helper_user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_events" ADD COLUMN "manager_group_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_events" ADD COLUMN "helper_group_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_events" ADD COLUMN "organizer_party_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_events" ADD COLUMN "speaker_party_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_events" ADD COLUMN "sponsor_party_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_events" ADD COLUMN "related_event_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_events" ADD COLUMN "signup_note" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_events" ADD COLUMN "terms_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE TABLE "sf_event_parties" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT 'Untitled' NOT NULL,
	"kind" text DEFAULT 'organizer' NOT NULL,
	"url" text DEFAULT '' NOT NULL,
	"blurb" text DEFAULT '' NOT NULL,
	"avatar_media_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sf_event_parties_kind_idx" ON "sf_event_parties" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "sf_event_parties_name_idx" ON "sf_event_parties" USING btree ("name");
