CREATE TABLE "sf_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"handle_changed_at" timestamp with time zone,
	"display_name" text DEFAULT '' NOT NULL,
	"headline" text DEFAULT '' NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"avatar_media_id" text DEFAULT '' NOT NULL,
	"cover_media_id" text DEFAULT '' NOT NULL,
	"birth_date" date,
	"gender" text DEFAULT '' NOT NULL,
	"country" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"website" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"locale" text DEFAULT '' NOT NULL,
	"timezone" text DEFAULT '' NOT NULL,
	"visibility" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"extensions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_media_owners" (
	"media_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"context" text DEFAULT 'general' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sf_profiles" ADD CONSTRAINT "sf_profiles_user_id_sf_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sf_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_media_owners" ADD CONSTRAINT "sf_media_owners_user_id_sf_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sf_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sf_profiles_handle_uidx" ON "sf_profiles" USING btree ("handle");--> statement-breakpoint
CREATE INDEX "sf_profiles_status_idx" ON "sf_profiles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sf_profiles_country_idx" ON "sf_profiles" USING btree ("country");--> statement-breakpoint
CREATE INDEX "sf_media_owners_user_idx" ON "sf_media_owners" USING btree ("user_id","context");
