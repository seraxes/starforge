import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Heal every scalar column Payload `site-settings` SELECTs / writes.
 *
 * Extends #125 Performance heal + D0 dashboard knobs for journal-stuck /
 * push-era DBs where earlier ADD COLUMN migrations were recorded but columns
 * never landed (or baseline predated them). CoreAdminLayout →
 * ensureSiteSettingsDefaults → updateSiteSettings fails without these.
 *
 * Idempotent: ADD COLUMN IF NOT EXISTS + CREATE TABLE/INDEX IF NOT EXISTS.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
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
    ADD COLUMN IF NOT EXISTS "dashboard_refresh_interval_sec" numeric DEFAULT 60;
  ALTER TABLE "payload"."site_settings"
    ADD COLUMN IF NOT EXISTS "dashboard_online_window_min" numeric DEFAULT 15;
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
    DROP COLUMN IF EXISTS "dashboard_refresh_interval_sec";
  ALTER TABLE "payload"."site_settings"
    DROP COLUMN IF EXISTS "dashboard_online_window_min";
  -- Do not drop Performance / feature / module_toggles — owned by earlier heals / baseline.
  `)
}
