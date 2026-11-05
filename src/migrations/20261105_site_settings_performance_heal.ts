import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Heal payload.site_settings columns + module_toggles array table (#108 / #110 / #122).
 *
 * Site Settings → Performance added formRateLimit*, publishedCache*, nullMissTtlSec
 * without a migration. Baseline still creates the global without those columns, so
 * migrate-only and older local DBs fail SELECTing them from updateSiteSettings /
 * ensureSiteSettingsDefaults (CoreAdminLayout). #122/#123 made ensure write module
 * toggles more often, surfacing the missing columns.
 *
 * Also ensures feature_* / admin_autosave / primary_nav_menu_id and the
 * site_settings_module_toggles child table exist (push-era / partial DBs).
 *
 * Idempotent: safe to re-run; no-op when objects already exist.
 * Superseded for full coverage by `20261105_site_settings_select_heal`
 * (adds Dashboard D0 columns + same Performance/feature set).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  -- Scalar columns Payload Site Settings selects / writes
  ALTER TABLE "payload"."site_settings"
    ADD COLUMN IF NOT EXISTS "site_name" varchar DEFAULT 'Starforge';
  ALTER TABLE "payload"."site_settings"
    ADD COLUMN IF NOT EXISTS "primary_nav_menu_id" varchar DEFAULT 'main';
  ALTER TABLE "payload"."site_settings"
    ADD COLUMN IF NOT EXISTS "admin_autosave_debounce_ms" numeric DEFAULT 800;
  ALTER TABLE "payload"."site_settings"
    ADD COLUMN IF NOT EXISTS "form_rate_limit_max" numeric DEFAULT 8;
  ALTER TABLE "payload"."site_settings"
    ADD COLUMN IF NOT EXISTS "form_rate_limit_window_sec" numeric DEFAULT 60;
  ALTER TABLE "payload"."site_settings"
    ADD COLUMN IF NOT EXISTS "published_cache_enabled" boolean DEFAULT true;
  ALTER TABLE "payload"."site_settings"
    ADD COLUMN IF NOT EXISTS "published_cache_ttl_sec" numeric DEFAULT 0;
  ALTER TABLE "payload"."site_settings"
    ADD COLUMN IF NOT EXISTS "null_miss_ttl_sec" numeric DEFAULT 60;
  ALTER TABLE "payload"."site_settings"
    ADD COLUMN IF NOT EXISTS "feature_registration" boolean DEFAULT true;
  ALTER TABLE "payload"."site_settings"
    ADD COLUMN IF NOT EXISTS "feature_rich_editor" boolean DEFAULT true;
  ALTER TABLE "payload"."site_settings"
    ADD COLUMN IF NOT EXISTS "feature_posts" boolean DEFAULT false;
  ALTER TABLE "payload"."site_settings"
    ADD COLUMN IF NOT EXISTS "feature_modules" boolean DEFAULT false;
  ALTER TABLE "payload"."site_settings"
    ADD COLUMN IF NOT EXISTS "feature_draft_preview" boolean DEFAULT false;
  ALTER TABLE "payload"."site_settings"
    ADD COLUMN IF NOT EXISTS "updated_at" timestamp(3) with time zone;
  ALTER TABLE "payload"."site_settings"
    ADD COLUMN IF NOT EXISTS "created_at" timestamp(3) with time zone;

  -- Module toggles array table (ensureSiteSettingsDefaults writes rows here)
  CREATE TABLE IF NOT EXISTS "payload"."site_settings_module_toggles" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "module_id" varchar NOT NULL,
    "enabled" boolean DEFAULT true
  );

  DO $$ BEGIN
    ALTER TABLE "payload"."site_settings_module_toggles"
      ADD CONSTRAINT "site_settings_module_toggles_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "payload"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN duplicate_object THEN NULL;
  END $$;

  CREATE INDEX IF NOT EXISTS "site_settings_module_toggles_order_idx"
    ON "payload"."site_settings_module_toggles" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "site_settings_module_toggles_parent_id_idx"
    ON "payload"."site_settings_module_toggles" USING btree ("_parent_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload"."site_settings"
    DROP COLUMN IF EXISTS "form_rate_limit_max";
  ALTER TABLE "payload"."site_settings"
    DROP COLUMN IF EXISTS "form_rate_limit_window_sec";
  ALTER TABLE "payload"."site_settings"
    DROP COLUMN IF EXISTS "published_cache_enabled";
  ALTER TABLE "payload"."site_settings"
    DROP COLUMN IF EXISTS "published_cache_ttl_sec";
  ALTER TABLE "payload"."site_settings"
    DROP COLUMN IF EXISTS "null_miss_ttl_sec";
  -- Do not drop feature_* / admin_autosave / module_toggles — baseline owns those.
  `)
}
