import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Pages OG image is a Starforge media id (text), not a Payload upload relation.
 * Copies meta_image_id → meta_media_id and drops the FK to payload.media.
 * The integer column stays until phase 4. Idempotent.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload"."pages" ADD COLUMN IF NOT EXISTS "meta_media_id" varchar;
    ALTER TABLE "payload"."_pages_v" ADD COLUMN IF NOT EXISTS "version_meta_media_id" varchar;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'payload' AND table_name = 'pages' AND column_name = 'meta_image_id'
      ) THEN
        UPDATE "payload"."pages"
        SET "meta_media_id" = "meta_image_id"::text
        WHERE "meta_media_id" IS NULL AND "meta_image_id" IS NOT NULL;
        ALTER TABLE "payload"."pages" DROP CONSTRAINT IF EXISTS "pages_meta_image_id_media_id_fk";
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'payload' AND table_name = '_pages_v' AND column_name = 'version_meta_image_id'
      ) THEN
        UPDATE "payload"."_pages_v"
        SET "version_meta_media_id" = "version_meta_image_id"::text
        WHERE "version_meta_media_id" IS NULL AND "version_meta_image_id" IS NOT NULL;
        ALTER TABLE "payload"."_pages_v"
          DROP CONSTRAINT IF EXISTS "_pages_v_version_meta_image_id_media_id_fk";
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload"."pages" DROP COLUMN IF EXISTS "meta_media_id";
    ALTER TABLE "payload"."_pages_v" DROP COLUMN IF EXISTS "version_meta_media_id";
  `)
}
