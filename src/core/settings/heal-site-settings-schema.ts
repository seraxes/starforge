/**
 * Idempotent heal for `payload.site_settings` columns Payload SELECTs.
 *
 * Migrations + `db:migrate` post-heal cover journal-stuck DBs, but local
 * upgrades often run only `npm run dev`. Call
 * {@link ensureSiteSettingsSchemaHealed} before any Payload findGlobal /
 * updateGlobal on site-settings so CoreAdminLayout recovers without migrate.
 */
import type { QueryResult } from 'pg'

/** Columns `db:migrate` verifies after heal (subset of full ADD list). */
export const SITE_SETTINGS_HEAL_VERIFY_COLUMNS = [
  'form_rate_limit_max',
  'form_rate_limit_window_sec',
  'published_cache_enabled',
  'published_cache_ttl_sec',
  'null_miss_ttl_sec',
  'dashboard_refresh_interval_sec',
  'dashboard_online_window_min',
  'realtime_enabled',
  'feature_registration',
  'feature_modules',
] as const

/**
 * Shared SQL for migrate script + boot heal.
 * Safe to re-run: ADD / CREATE IF NOT EXISTS only.
 */
export const SITE_SETTINGS_SCHEMA_HEAL_SQL = `
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
    ADD COLUMN IF NOT EXISTS "realtime_enabled" boolean DEFAULT true;
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
      FOREIGN KEY ("_parent_id") REFERENCES "payload"."site_settings"("id")
      ON DELETE cascade ON UPDATE no action;
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN duplicate_object THEN NULL;
  END $$;

  CREATE INDEX IF NOT EXISTS "site_settings_module_toggles_order_idx"
    ON "payload"."site_settings_module_toggles" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "site_settings_module_toggles_parent_id_idx"
    ON "payload"."site_settings_module_toggles" USING btree ("_parent_id");
`

type Queryable = {
  query: (text: string, values?: unknown[]) => Promise<QueryResult>
}

export type SiteSettingsSchemaHealResult = {
  /** True when ALTER/CREATE ran (table existed). */
  healed: boolean
  /** True when payload.site_settings was missing — skipped. */
  skipped: boolean
}

/**
 * Apply select-column heal via any pg-compatible client (migrate script or pool).
 */
export async function healSiteSettingsSchema(
  client: Queryable,
): Promise<SiteSettingsSchemaHealResult> {
  const exists = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'payload' AND table_name = 'site_settings'
     ) AS exists`,
  )
  const row = exists.rows[0] as { exists?: boolean } | undefined
  if (!row?.exists) {
    return { healed: false, skipped: true }
  }

  await client.query(SITE_SETTINGS_SCHEMA_HEAL_SQL)
  return { healed: true, skipped: false }
}

/**
 * Bump when SITE_SETTINGS_SCHEMA_HEAL_SQL gains columns so HMR / long-lived
 * `next dev` re-runs IF NOT EXISTS ALTERs instead of reusing a stale memo.
 */
export const SITE_SETTINGS_SCHEMA_HEAL_REVISION = 2

const globalForHeal = globalThis as unknown as {
  starforgeSiteSettingsSchemaHeal?: Promise<SiteSettingsSchemaHealResult>
  starforgeSiteSettingsSchemaHealRevision?: number
}

/**
 * Once-per-process boot heal before Payload site-settings SELECT/UPDATE.
 * Retries on failure (clears memo so the next request can recover).
 * Re-runs when {@link SITE_SETTINGS_SCHEMA_HEAL_REVISION} changes (new columns).
 */
export async function ensureSiteSettingsSchemaHealed(): Promise<SiteSettingsSchemaHealResult> {
  if (
    globalForHeal.starforgeSiteSettingsSchemaHeal &&
    globalForHeal.starforgeSiteSettingsSchemaHealRevision === SITE_SETTINGS_SCHEMA_HEAL_REVISION
  ) {
    return globalForHeal.starforgeSiteSettingsSchemaHeal
  }

  globalForHeal.starforgeSiteSettingsSchemaHealRevision = SITE_SETTINGS_SCHEMA_HEAL_REVISION
  globalForHeal.starforgeSiteSettingsSchemaHeal = (async () => {
    // Dynamic import keeps this module pool-free for `db:migrate` / unit tests.
    const { pool } = await import('@/core/db')
    const client = await pool.connect()
    try {
      return await healSiteSettingsSchema(client)
    } finally {
      client.release()
    }
  })().catch((err) => {
    globalForHeal.starforgeSiteSettingsSchemaHeal = undefined
    globalForHeal.starforgeSiteSettingsSchemaHealRevision = undefined
    throw err
  })
  return globalForHeal.starforgeSiteSettingsSchemaHeal
}

/** Test / migrate helper — clear process memo after intentional schema drops. */
export function resetSiteSettingsSchemaHealMemoForTests(): void {
  globalForHeal.starforgeSiteSettingsSchemaHeal = undefined
  globalForHeal.starforgeSiteSettingsSchemaHealRevision = undefined
}
