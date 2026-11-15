-- product:media document store (phase 2b). Idempotent.
-- Copies payload.media, payload.categories, and media↔tag rels into sf_media_*.
-- Migrated ids are the Payload id rendered as text, so existing mediaId binds
-- and sf_media_owners stay valid. payload_legacy_id is the one-shot copy key.
-- New app rows use uuid text ids (not written here).
-- Pages OG: meta_media_id text copied from meta_image_id. The upload FK is dropped
-- so pages do not require payload.media. The integer column is left until phase 4.
-- Safe to re-run: inserts skip rows that already have payload_legacy_id.
-- db:migrate replays this file after Payload migrate so a fresh database can copy
-- once payload.media exists.
CREATE TABLE IF NOT EXISTS "sf_media_categories" (
  "id" text PRIMARY KEY NOT NULL,
  "payload_legacy_id" integer,
  "title" text NOT NULL,
  "slug" text NOT NULL,
  "parent_id" text,
  "path" text,
  "depth" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sf_media_tags" (
  "id" text PRIMARY KEY NOT NULL,
  "payload_legacy_id" integer,
  "title" text NOT NULL,
  "slug" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sf_media_assets" (
  "id" text PRIMARY KEY NOT NULL,
  "payload_legacy_id" integer,
  "alt" text NOT NULL,
  "mime_type" text,
  "filename" text,
  "filesize" integer,
  "width" integer,
  "height" integer,
  "purpose" text DEFAULT 'photo' NOT NULL,
  "folder" text DEFAULT 'general' NOT NULL,
  "private" boolean DEFAULT false NOT NULL,
  "category_id" text,
  "url" text,
  "path" text,
  "sizes" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sf_media_asset_tags" (
  "asset_id" text NOT NULL,
  "tag_id" text NOT NULL,
  CONSTRAINT "sf_media_asset_tags_pk" PRIMARY KEY ("asset_id", "tag_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sf_media_categories_slug_idx" ON "sf_media_categories" ("slug");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sf_media_categories_legacy_idx" ON "sf_media_categories" ("payload_legacy_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sf_media_categories_parent_idx" ON "sf_media_categories" ("parent_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sf_media_tags_slug_idx" ON "sf_media_tags" ("slug");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sf_media_tags_legacy_idx" ON "sf_media_tags" ("payload_legacy_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sf_media_assets_legacy_idx" ON "sf_media_assets" ("payload_legacy_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sf_media_assets_filename_idx" ON "sf_media_assets" ("filename");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sf_media_assets_category_idx" ON "sf_media_assets" ("category_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sf_media_assets_created_idx" ON "sf_media_assets" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sf_media_assets_folder_idx" ON "sf_media_assets" ("folder");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sf_media_asset_tags_tag_idx" ON "sf_media_asset_tags" ("tag_id");
--> statement-breakpoint
DO $$
DECLARE
  has_media boolean;
  has_category_id boolean;
  has_categories boolean;
  has_tags boolean;
  has_media_rels boolean;
  has_pages boolean;
  has_pages_image boolean;
  has_versions boolean;
  has_version_image boolean;
BEGIN
  SELECT to_regclass('payload.media') IS NOT NULL INTO has_media;
  SELECT to_regclass('payload.categories') IS NOT NULL INTO has_categories;
  SELECT to_regclass('payload.tags') IS NOT NULL INTO has_tags;
  SELECT to_regclass('payload.media_rels') IS NOT NULL INTO has_media_rels;

  IF has_categories THEN
    INSERT INTO "sf_media_categories" (
      "id", "payload_legacy_id", "title", "slug", "parent_id", "path", "depth", "created_at", "updated_at"
    )
    SELECT
      c.id::text,
      c.id,
      c.title,
      c.slug,
      CASE WHEN c.parent_id IS NULL THEN NULL ELSE c.parent_id::text END,
      c.path,
      COALESCE(c.depth, 0)::int,
      c.created_at,
      c.updated_at
    FROM "payload"."categories" c
    WHERE NOT EXISTS (
      SELECT 1 FROM "sf_media_categories" s WHERE s.payload_legacy_id = c.id
    )
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE "sf_media_categories" AS c
  SET "parent_id" = NULL
  WHERE c."parent_id" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM "sf_media_categories" AS p WHERE p."id" = c."parent_id"
    );

  IF has_tags AND has_media_rels THEN
    -- Tags already attached to media. Shared page+media tags are copied; pages keep Payload.
    INSERT INTO "sf_media_tags" (
      "id", "payload_legacy_id", "title", "slug", "created_at", "updated_at"
    )
    SELECT t.id::text, t.id, t.title, t.slug, t.created_at, t.updated_at
    FROM "payload"."tags" t
    WHERE EXISTS (
      SELECT 1 FROM "payload"."media_rels" r WHERE r.tags_id = t.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM "sf_media_tags" s WHERE s.payload_legacy_id = t.id
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF has_tags AND to_regclass('payload.pages_rels') IS NOT NULL THEN
    -- Tags pages do not use (media-only or unused). Page-only tags stay on Payload.
    INSERT INTO "sf_media_tags" (
      "id", "payload_legacy_id", "title", "slug", "created_at", "updated_at"
    )
    SELECT t.id::text, t.id, t.title, t.slug, t.created_at, t.updated_at
    FROM "payload"."tags" t
    WHERE NOT EXISTS (
      SELECT 1 FROM "payload"."pages_rels" pr WHERE pr.tags_id = t.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM "sf_media_tags" s WHERE s.payload_legacy_id = t.id
    )
    ON CONFLICT DO NOTHING;
  ELSIF has_tags THEN
    INSERT INTO "sf_media_tags" (
      "id", "payload_legacy_id", "title", "slug", "created_at", "updated_at"
    )
    SELECT t.id::text, t.id, t.title, t.slug, t.created_at, t.updated_at
    FROM "payload"."tags" t
    WHERE NOT EXISTS (
      SELECT 1 FROM "sf_media_tags" s WHERE s.payload_legacy_id = t.id
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF has_media THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'payload' AND table_name = 'media' AND column_name = 'category_id'
    ) INTO has_category_id;

    IF has_category_id THEN
      INSERT INTO "sf_media_assets" (
        "id", "payload_legacy_id", "alt", "mime_type", "filename", "filesize",
        "width", "height", "purpose", "folder", "private", "category_id",
        "url", "path", "sizes", "created_at", "updated_at"
      )
      SELECT
        m.id::text,
        m.id,
        COALESCE(m.alt, 'Image'),
        m.mime_type,
        m.filename,
        CASE
          WHEN m.filesize IS NULL THEN NULL
          WHEN m.filesize > 2147483647 THEN 2147483647
          ELSE m.filesize::int
        END,
        CASE
          WHEN m.width IS NULL THEN NULL
          WHEN m.width > 2147483647 THEN 2147483647
          ELSE m.width::int
        END,
        CASE
          WHEN m.height IS NULL THEN NULL
          WHEN m.height > 2147483647 THEN 2147483647
          ELSE m.height::int
        END,
        COALESCE(m.purpose::text, 'photo'),
        COALESCE(m.folder::text, 'general'),
        COALESCE(m.private, false),
        CASE WHEN m.category_id IS NULL THEN NULL ELSE m.category_id::text END,
        m.url,
        m.filename,
        CASE
          WHEN m.sizes_thumbnail_filename IS NULL
           AND m.sizes_thumbnail_url IS NULL
           AND m.sizes_card_filename IS NULL
           AND m.sizes_card_url IS NULL
           AND m.sizes_large_filename IS NULL
           AND m.sizes_large_url IS NULL
          THEN NULL
          ELSE jsonb_strip_nulls(jsonb_build_object(
            'thumbnail', CASE
              WHEN m.sizes_thumbnail_filename IS NULL AND m.sizes_thumbnail_url IS NULL THEN NULL
              ELSE jsonb_strip_nulls(jsonb_build_object(
                'url', m.sizes_thumbnail_url,
                'path', m.sizes_thumbnail_filename,
                'filename', m.sizes_thumbnail_filename,
                'width', CASE WHEN m.sizes_thumbnail_width IS NULL THEN NULL ELSE LEAST(m.sizes_thumbnail_width, 2147483647)::int END,
                'height', CASE WHEN m.sizes_thumbnail_height IS NULL THEN NULL ELSE LEAST(m.sizes_thumbnail_height, 2147483647)::int END,
                'mimeType', m.sizes_thumbnail_mime_type,
                'filesize', CASE WHEN m.sizes_thumbnail_filesize IS NULL THEN NULL ELSE LEAST(m.sizes_thumbnail_filesize, 2147483647)::int END
              ))
            END,
            'card', CASE
              WHEN m.sizes_card_filename IS NULL AND m.sizes_card_url IS NULL THEN NULL
              ELSE jsonb_strip_nulls(jsonb_build_object(
                'url', m.sizes_card_url,
                'path', m.sizes_card_filename,
                'filename', m.sizes_card_filename,
                'width', CASE WHEN m.sizes_card_width IS NULL THEN NULL ELSE LEAST(m.sizes_card_width, 2147483647)::int END,
                'height', CASE WHEN m.sizes_card_height IS NULL THEN NULL ELSE LEAST(m.sizes_card_height, 2147483647)::int END,
                'mimeType', m.sizes_card_mime_type,
                'filesize', CASE WHEN m.sizes_card_filesize IS NULL THEN NULL ELSE LEAST(m.sizes_card_filesize, 2147483647)::int END
              ))
            END,
            'large', CASE
              WHEN m.sizes_large_filename IS NULL AND m.sizes_large_url IS NULL THEN NULL
              ELSE jsonb_strip_nulls(jsonb_build_object(
                'url', m.sizes_large_url,
                'path', m.sizes_large_filename,
                'filename', m.sizes_large_filename,
                'width', CASE WHEN m.sizes_large_width IS NULL THEN NULL ELSE LEAST(m.sizes_large_width, 2147483647)::int END,
                'height', CASE WHEN m.sizes_large_height IS NULL THEN NULL ELSE LEAST(m.sizes_large_height, 2147483647)::int END,
                'mimeType', m.sizes_large_mime_type,
                'filesize', CASE WHEN m.sizes_large_filesize IS NULL THEN NULL ELSE LEAST(m.sizes_large_filesize, 2147483647)::int END
              ))
            END
          ))
        END,
        m.created_at,
        m.updated_at
      FROM "payload"."media" m
      WHERE NOT EXISTS (
        SELECT 1 FROM "sf_media_assets" s WHERE s.payload_legacy_id = m.id
      )
      ON CONFLICT DO NOTHING;
    ELSE
      INSERT INTO "sf_media_assets" (
        "id", "payload_legacy_id", "alt", "mime_type", "filename", "filesize",
        "width", "height", "purpose", "folder", "private", "category_id",
        "url", "path", "sizes", "created_at", "updated_at"
      )
      SELECT
        m.id::text,
        m.id,
        COALESCE(m.alt, 'Image'),
        m.mime_type,
        m.filename,
        CASE
          WHEN m.filesize IS NULL THEN NULL
          WHEN m.filesize > 2147483647 THEN 2147483647
          ELSE m.filesize::int
        END,
        CASE WHEN m.width IS NULL THEN NULL WHEN m.width > 2147483647 THEN 2147483647 ELSE m.width::int END,
        CASE WHEN m.height IS NULL THEN NULL WHEN m.height > 2147483647 THEN 2147483647 ELSE m.height::int END,
        COALESCE(m.purpose::text, 'photo'),
        COALESCE(m.folder::text, 'general'),
        COALESCE(m.private, false),
        NULL,
        m.url,
        m.filename,
        NULL,
        m.created_at,
        m.updated_at
      FROM "payload"."media" m
      WHERE NOT EXISTS (
        SELECT 1 FROM "sf_media_assets" s WHERE s.payload_legacy_id = m.id
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  UPDATE "sf_media_assets" AS a
  SET "category_id" = NULL
  WHERE a."category_id" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM "sf_media_categories" AS c WHERE c."id" = a."category_id"
    );

  IF has_media_rels THEN
    INSERT INTO "sf_media_asset_tags" ("asset_id", "tag_id")
    SELECT DISTINCT r.parent_id::text, r.tags_id::text
    FROM "payload"."media_rels" r
    WHERE r.tags_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM "sf_media_assets" a WHERE a.id = r.parent_id::text)
      AND EXISTS (SELECT 1 FROM "sf_media_tags" t WHERE t.id = r.tags_id::text)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Remap the member ledger only when a migrated id differs from the legacy decimal text.
  UPDATE "sf_media_owners" AS o
  SET "media_id" = a."id"
  FROM "sf_media_assets" AS a
  WHERE a."payload_legacy_id" IS NOT NULL
    AND o."media_id" = a."payload_legacy_id"::text
    AND o."media_id" IS DISTINCT FROM a."id";

  SELECT to_regclass('payload.pages') IS NOT NULL INTO has_pages;
  IF has_pages THEN
    ALTER TABLE "payload"."pages" ADD COLUMN IF NOT EXISTS "meta_media_id" varchar;
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'payload' AND table_name = 'pages' AND column_name = 'meta_image_id'
    ) INTO has_pages_image;
    IF has_pages_image THEN
      UPDATE "payload"."pages"
      SET "meta_media_id" = "meta_image_id"::text
      WHERE "meta_media_id" IS NULL AND "meta_image_id" IS NOT NULL;
      ALTER TABLE "payload"."pages" DROP CONSTRAINT IF EXISTS "pages_meta_image_id_media_id_fk";
    END IF;
  END IF;

  SELECT to_regclass('payload._pages_v') IS NOT NULL INTO has_versions;
  IF has_versions THEN
    ALTER TABLE "payload"."_pages_v" ADD COLUMN IF NOT EXISTS "version_meta_media_id" varchar;
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'payload' AND table_name = '_pages_v' AND column_name = 'version_meta_image_id'
    ) INTO has_version_image;
    IF has_version_image THEN
      UPDATE "payload"."_pages_v"
      SET "version_meta_media_id" = "version_meta_image_id"::text
      WHERE "version_meta_media_id" IS NULL AND "version_meta_image_id" IS NOT NULL;
      ALTER TABLE "payload"."_pages_v" DROP CONSTRAINT IF EXISTS "_pages_v_version_meta_image_id_media_id_fk";
    END IF;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sf_media_categories"
    ADD CONSTRAINT "sf_media_categories_parent_fk"
    FOREIGN KEY ("parent_id") REFERENCES "sf_media_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sf_media_assets"
    ADD CONSTRAINT "sf_media_assets_category_fk"
    FOREIGN KEY ("category_id") REFERENCES "sf_media_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sf_media_asset_tags"
    ADD CONSTRAINT "sf_media_asset_tags_asset_fk"
    FOREIGN KEY ("asset_id") REFERENCES "sf_media_assets"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sf_media_asset_tags"
    ADD CONSTRAINT "sf_media_asset_tags_tag_fk"
    FOREIGN KEY ("tag_id") REFERENCES "sf_media_tags"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
