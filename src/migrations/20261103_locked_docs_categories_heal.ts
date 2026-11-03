import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Heal payload_locked_documents_rels.categories_id (SF-175 / same pattern as tags_id #95).
 *
 * Nested Categories (phase2) registers the `categories` collection, so Payload document-lock
 * SELECTs always reference categories_id. Push-era / partial DBs (or a phase2 run that was
 * journaled before the column landed) can leave the column missing → runtime Failed query.
 *
 * Idempotent: safe to re-run; no-op when the column already exists.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload"."payload_locked_documents_rels"
    ADD COLUMN IF NOT EXISTS "categories_id" integer;

  DO $$ BEGIN
    ALTER TABLE "payload"."payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_categories_fk"
      FOREIGN KEY ("categories_id") REFERENCES "payload"."categories"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
    WHEN undefined_table THEN NULL; -- categories not created yet; phase2 owns table create
    WHEN duplicate_object THEN NULL;
  END $$;

  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_categories_id_idx"
    ON "payload"."payload_locked_documents_rels" USING btree ("categories_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload"."payload_locked_documents_rels"
    DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_categories_fk";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_categories_id_idx";
  ALTER TABLE "payload"."payload_locked_documents_rels"
    DROP COLUMN IF EXISTS "categories_id";
  `)
}
