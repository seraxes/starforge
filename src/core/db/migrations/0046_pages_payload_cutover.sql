-- product:pages phase 3b. Schema only.
-- The row copy (payload.pages → sf_pages_*, Nav id remap, Lexical → HTML,
-- content-locale files) runs in scripts/db-migrate.mts after Payload migrate,
-- because locale files are not SQL. Safe to re-run: columns and indexes
-- use IF NOT EXISTS. Copy itself is idempotent on payload_legacy_id.
ALTER TABLE "sf_pages" ADD COLUMN IF NOT EXISTS "payload_legacy_id" integer;
--> statement-breakpoint
ALTER TABLE "sf_pages" ADD COLUMN IF NOT EXISTS "payload_content_copied_at" timestamp with time zone;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sf_pages_legacy_idx" ON "sf_pages" ("payload_legacy_id");
--> statement-breakpoint
ALTER TABLE "sf_pages_tags" ADD COLUMN IF NOT EXISTS "payload_legacy_id" integer;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sf_pages_tags_legacy_idx" ON "sf_pages_tags" ("payload_legacy_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sf_pages_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "page_id" text NOT NULL,
  "payload_legacy_id" integer,
  "title" text DEFAULT '' NOT NULL,
  "body" text DEFAULT '' NOT NULL,
  "meta_title" text DEFAULT '' NOT NULL,
  "meta_description" text DEFAULT '' NOT NULL,
  "meta_media_id" text DEFAULT '' NOT NULL,
  "slug" text DEFAULT '' NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "tags" text DEFAULT '' NOT NULL,
  "locales" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "sf_pages_versions_page_id_sf_pages_id_fk"
    FOREIGN KEY ("page_id") REFERENCES "public"."sf_pages"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sf_pages_versions_page_idx" ON "sf_pages_versions" ("page_id", "created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sf_pages_versions_legacy_idx" ON "sf_pages_versions" ("payload_legacy_id");
