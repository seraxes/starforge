import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * i18n P1 — Payload pages localization (en/hu).
 *
 * Moves localized fields (title, body, meta title/description) into
 * `pages_locales` / `_pages_v_locales`. Slug stays on the parent row (shared).
 * Existing values are copied into the default locale (`en`) before columns drop.
 *
 * Snapshots for migrate:create were stale vs heal migrations, so this file is
 * hand-scoped to localization only (no categories / media_rels / site_settings).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  DO $$ BEGIN
    CREATE TYPE "payload"."_locales" AS ENUM('en', 'hu');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  DO $$ BEGIN
    CREATE TYPE "payload"."enum__pages_v_published_locale" AS ENUM('en', 'hu');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  CREATE TABLE IF NOT EXISTS "payload"."pages_locales" (
    "title" varchar,
    "body" jsonb,
    "meta_title" varchar,
    "meta_description" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "payload"."_locales" NOT NULL,
    "_parent_id" integer NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "payload"."_pages_v_locales" (
    "version_title" varchar,
    "version_body" jsonb,
    "version_meta_title" varchar,
    "version_meta_description" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "payload"."_locales" NOT NULL,
    "_parent_id" integer NOT NULL
  );

  ALTER TABLE "payload"."_pages_v" ADD COLUMN IF NOT EXISTS "snapshot" boolean;
  ALTER TABLE "payload"."_pages_v" ADD COLUMN IF NOT EXISTS "published_locale" "payload"."enum__pages_v_published_locale";

  DO $$ BEGIN
    ALTER TABLE "payload"."pages_locales"
      ADD CONSTRAINT "pages_locales_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "payload"."pages"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  DO $$ BEGIN
    ALTER TABLE "payload"."_pages_v_locales"
      ADD CONSTRAINT "_pages_v_locales_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "payload"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  CREATE UNIQUE INDEX IF NOT EXISTS "pages_locales_locale_parent_id_unique"
    ON "payload"."pages_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_locales_parent_id_idx"
    ON "payload"."pages_locales" USING btree ("_parent_id");
  CREATE UNIQUE INDEX IF NOT EXISTS "_pages_v_locales_locale_parent_id_unique"
    ON "payload"."_pages_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX IF NOT EXISTS "_pages_v_locales_parent_id_idx"
    ON "payload"."_pages_v_locales" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "_pages_v_snapshot_idx"
    ON "payload"."_pages_v" USING btree ("snapshot");
  CREATE INDEX IF NOT EXISTS "_pages_v_published_locale_idx"
    ON "payload"."_pages_v" USING btree ("published_locale");

  -- Preserve existing EN content before dropping localized columns (idempotent).
  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'payload' AND table_name = 'pages' AND column_name = 'title'
    ) THEN
      INSERT INTO "payload"."pages_locales" ("title", "body", "meta_title", "meta_description", "_locale", "_parent_id")
      SELECT "title", "body", "meta_title", "meta_description", 'en'::"payload"."_locales", "id"
      FROM "payload"."pages" p
      WHERE NOT EXISTS (
        SELECT 1 FROM "payload"."pages_locales" pl
        WHERE pl."_parent_id" = p."id" AND pl."_locale" = 'en'
      );

      ALTER TABLE "payload"."pages" DROP COLUMN IF EXISTS "title";
      ALTER TABLE "payload"."pages" DROP COLUMN IF EXISTS "body";
      ALTER TABLE "payload"."pages" DROP COLUMN IF EXISTS "meta_title";
      ALTER TABLE "payload"."pages" DROP COLUMN IF EXISTS "meta_description";
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'payload' AND table_name = '_pages_v' AND column_name = 'version_title'
    ) THEN
      INSERT INTO "payload"."_pages_v_locales" (
        "version_title", "version_body", "version_meta_title", "version_meta_description", "_locale", "_parent_id"
      )
      SELECT "version_title", "version_body", "version_meta_title", "version_meta_description",
             'en'::"payload"."_locales", "id"
      FROM "payload"."_pages_v" v
      WHERE NOT EXISTS (
        SELECT 1 FROM "payload"."_pages_v_locales" vl
        WHERE vl."_parent_id" = v."id" AND vl."_locale" = 'en'
      );

      ALTER TABLE "payload"."_pages_v" DROP COLUMN IF EXISTS "version_title";
      ALTER TABLE "payload"."_pages_v" DROP COLUMN IF EXISTS "version_body";
      ALTER TABLE "payload"."_pages_v" DROP COLUMN IF EXISTS "version_meta_title";
      ALTER TABLE "payload"."_pages_v" DROP COLUMN IF EXISTS "version_meta_description";
    END IF;
  END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload"."pages" ADD COLUMN IF NOT EXISTS "title" varchar;
  ALTER TABLE "payload"."pages" ADD COLUMN IF NOT EXISTS "body" jsonb;
  ALTER TABLE "payload"."pages" ADD COLUMN IF NOT EXISTS "meta_title" varchar;
  ALTER TABLE "payload"."pages" ADD COLUMN IF NOT EXISTS "meta_description" varchar;
  ALTER TABLE "payload"."_pages_v" ADD COLUMN IF NOT EXISTS "version_title" varchar;
  ALTER TABLE "payload"."_pages_v" ADD COLUMN IF NOT EXISTS "version_body" jsonb;
  ALTER TABLE "payload"."_pages_v" ADD COLUMN IF NOT EXISTS "version_meta_title" varchar;
  ALTER TABLE "payload"."_pages_v" ADD COLUMN IF NOT EXISTS "version_meta_description" varchar;

  UPDATE "payload"."pages" p
  SET
    "title" = pl."title",
    "body" = pl."body",
    "meta_title" = pl."meta_title",
    "meta_description" = pl."meta_description"
  FROM "payload"."pages_locales" pl
  WHERE pl."_parent_id" = p."id" AND pl."_locale" = 'en';

  UPDATE "payload"."_pages_v" v
  SET
    "version_title" = vl."version_title",
    "version_body" = vl."version_body",
    "version_meta_title" = vl."version_meta_title",
    "version_meta_description" = vl."version_meta_description"
  FROM "payload"."_pages_v_locales" vl
  WHERE vl."_parent_id" = v."id" AND vl."_locale" = 'en';

  DROP TABLE IF EXISTS "payload"."pages_locales" CASCADE;
  DROP TABLE IF EXISTS "payload"."_pages_v_locales" CASCADE;

  DROP INDEX IF EXISTS "payload"."_pages_v_snapshot_idx";
  DROP INDEX IF EXISTS "payload"."_pages_v_published_locale_idx";
  ALTER TABLE "payload"."_pages_v" DROP COLUMN IF EXISTS "snapshot";
  ALTER TABLE "payload"."_pages_v" DROP COLUMN IF EXISTS "published_locale";

  DROP TYPE IF EXISTS "payload"."enum__pages_v_published_locale";
  DROP TYPE IF EXISTS "payload"."_locales";
  `)
}
