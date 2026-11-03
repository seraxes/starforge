import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Phase 2: nested Categories taxonomy + Media.category.
 * Seeds root folders from legacy MEDIA_FOLDERS and maps media.folder → category.
 * Keeps media.folder for Form privacy (forms) during deprecation.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE IF NOT EXISTS "payload"."categories" (
    "id" serial PRIMARY KEY NOT NULL,
    "title" varchar NOT NULL,
    "slug" varchar NOT NULL,
    "parent_id" integer,
    "path" varchar,
    "depth" numeric DEFAULT 0,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  DO $$ BEGIN
    ALTER TABLE "payload"."categories"
      ADD CONSTRAINT "categories_parent_id_fk"
      FOREIGN KEY ("parent_id") REFERENCES "payload"."categories"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  CREATE UNIQUE INDEX IF NOT EXISTS "categories_slug_idx" ON "payload"."categories" USING btree ("slug");
  CREATE INDEX IF NOT EXISTS "categories_parent_idx" ON "payload"."categories" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "categories_updated_at_idx" ON "payload"."categories" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "categories_created_at_idx" ON "payload"."categories" USING btree ("created_at");

  ALTER TABLE "payload"."media"
    ADD COLUMN IF NOT EXISTS "category_id" integer;

  DO $$ BEGIN
    ALTER TABLE "payload"."media"
      ADD CONSTRAINT "media_category_id_fk"
      FOREIGN KEY ("category_id") REFERENCES "payload"."categories"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  CREATE INDEX IF NOT EXISTS "media_category_idx" ON "payload"."media" USING btree ("category_id");

  ALTER TABLE "payload"."payload_locked_documents_rels"
    ADD COLUMN IF NOT EXISTS "categories_id" integer;

  DO $$ BEGIN
    ALTER TABLE "payload"."payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_categories_fk"
      FOREIGN KEY ("categories_id") REFERENCES "payload"."categories"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_categories_id_idx"
    ON "payload"."payload_locked_documents_rels" USING btree ("categories_id");

  -- Seed legacy flat folders as root categories (idempotent on slug).
  INSERT INTO "payload"."categories" ("title", "slug", "parent_id", "path", "depth")
  VALUES
    ('General', 'general', NULL, 'General', 0),
    ('Logos', 'logos', NULL, 'Logos', 0),
    ('Backgrounds', 'backgrounds', NULL, 'Backgrounds', 0),
    ('Pages', 'pages', NULL, 'Pages', 0),
    ('Forms', 'forms', NULL, 'Forms', 0)
  ON CONFLICT ("slug") DO NOTHING;

  -- Map existing media.folder values onto seeded roots.
  UPDATE "payload"."media" AS m
  SET "category_id" = c."id"
  FROM "payload"."categories" AS c
  WHERE m."category_id" IS NULL
    AND m."folder"::text = c."slug";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload"."media" DROP CONSTRAINT IF EXISTS "media_category_id_fk";
  DROP INDEX IF EXISTS "payload"."media_category_idx";
  ALTER TABLE "payload"."media" DROP COLUMN IF EXISTS "category_id";

  ALTER TABLE "payload"."payload_locked_documents_rels"
    DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_categories_fk";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_categories_id_idx";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "categories_id";

  DROP TABLE IF EXISTS "payload"."categories" CASCADE;
  `)
}
