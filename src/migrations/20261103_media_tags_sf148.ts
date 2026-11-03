import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Creates shared `tags` + relationship tables for Pages/Media.
 * SF-132 shipped Tags/Pages.tags without a migration; this catches fresh installs
 * and adds Media.tags (SF-148). Uses IF NOT EXISTS so push-dev DBs stay safe.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE IF NOT EXISTS "payload"."tags" (
    "id" serial PRIMARY KEY NOT NULL,
    "title" varchar NOT NULL,
    "slug" varchar NOT NULL,
    "description" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS "tags_slug_idx" ON "payload"."tags" USING btree ("slug");
  CREATE INDEX IF NOT EXISTS "tags_updated_at_idx" ON "payload"."tags" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "tags_created_at_idx" ON "payload"."tags" USING btree ("created_at");

  CREATE TABLE IF NOT EXISTS "payload"."pages_rels" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer,
    "parent_id" integer NOT NULL,
    "path" varchar NOT NULL,
    "tags_id" integer
  );

  DO $$ BEGIN
    ALTER TABLE "payload"."pages_rels"
      ADD CONSTRAINT "pages_rels_parent_fk"
      FOREIGN KEY ("parent_id") REFERENCES "payload"."pages"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  DO $$ BEGIN
    ALTER TABLE "payload"."pages_rels"
      ADD CONSTRAINT "pages_rels_tags_fk"
      FOREIGN KEY ("tags_id") REFERENCES "payload"."tags"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  CREATE INDEX IF NOT EXISTS "pages_rels_order_idx" ON "payload"."pages_rels" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "pages_rels_parent_idx" ON "payload"."pages_rels" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "pages_rels_path_idx" ON "payload"."pages_rels" USING btree ("path");
  CREATE INDEX IF NOT EXISTS "pages_rels_tags_id_idx" ON "payload"."pages_rels" USING btree ("tags_id");

  CREATE TABLE IF NOT EXISTS "payload"."_pages_v_rels" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer,
    "parent_id" integer NOT NULL,
    "path" varchar NOT NULL,
    "tags_id" integer
  );

  DO $$ BEGIN
    ALTER TABLE "payload"."_pages_v_rels"
      ADD CONSTRAINT "_pages_v_rels_parent_fk"
      FOREIGN KEY ("parent_id") REFERENCES "payload"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  DO $$ BEGIN
    ALTER TABLE "payload"."_pages_v_rels"
      ADD CONSTRAINT "_pages_v_rels_tags_fk"
      FOREIGN KEY ("tags_id") REFERENCES "payload"."tags"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  CREATE INDEX IF NOT EXISTS "_pages_v_rels_order_idx" ON "payload"."_pages_v_rels" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "_pages_v_rels_parent_idx" ON "payload"."_pages_v_rels" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "_pages_v_rels_path_idx" ON "payload"."_pages_v_rels" USING btree ("path");
  CREATE INDEX IF NOT EXISTS "_pages_v_rels_tags_id_idx" ON "payload"."_pages_v_rels" USING btree ("tags_id");

  CREATE TABLE IF NOT EXISTS "payload"."media_rels" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer,
    "parent_id" integer NOT NULL,
    "path" varchar NOT NULL,
    "tags_id" integer
  );

  DO $$ BEGIN
    ALTER TABLE "payload"."media_rels"
      ADD CONSTRAINT "media_rels_parent_fk"
      FOREIGN KEY ("parent_id") REFERENCES "payload"."media"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  DO $$ BEGIN
    ALTER TABLE "payload"."media_rels"
      ADD CONSTRAINT "media_rels_tags_fk"
      FOREIGN KEY ("tags_id") REFERENCES "payload"."tags"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  CREATE INDEX IF NOT EXISTS "media_rels_order_idx" ON "payload"."media_rels" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "media_rels_parent_idx" ON "payload"."media_rels" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "media_rels_path_idx" ON "payload"."media_rels" USING btree ("path");
  CREATE INDEX IF NOT EXISTS "media_rels_tags_id_idx" ON "payload"."media_rels" USING btree ("tags_id");

  ALTER TABLE "payload"."payload_locked_documents_rels"
    ADD COLUMN IF NOT EXISTS "tags_id" integer;

  DO $$ BEGIN
    ALTER TABLE "payload"."payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_tags_fk"
      FOREIGN KEY ("tags_id") REFERENCES "payload"."tags"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_tags_id_idx"
    ON "payload"."payload_locked_documents_rels" USING btree ("tags_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE IF EXISTS "payload"."media_rels" CASCADE;
  DROP TABLE IF EXISTS "payload"."_pages_v_rels" CASCADE;
  DROP TABLE IF EXISTS "payload"."pages_rels" CASCADE;
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_tags_fk";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_tags_id_idx";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "tags_id";
  DROP TABLE IF EXISTS "payload"."tags" CASCADE;
  `)
}
