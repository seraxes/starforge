import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Site Settings → Performance: Dashboard refresh interval + online window (D0).
 * Idempotent ADD COLUMN IF NOT EXISTS.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload"."site_settings"
    ADD COLUMN IF NOT EXISTS "dashboard_refresh_interval_sec" numeric DEFAULT 60;
  ALTER TABLE "payload"."site_settings"
    ADD COLUMN IF NOT EXISTS "dashboard_online_window_min" numeric DEFAULT 15;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload"."site_settings"
    DROP COLUMN IF EXISTS "dashboard_refresh_interval_sec";
  ALTER TABLE "payload"."site_settings"
    DROP COLUMN IF EXISTS "dashboard_online_window_min";
  `)
}
