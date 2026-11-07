import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Site Settings → Performance: RealtimePort enable (`realtimeEnabled`).
 *
 * Boot heal also ADD IF NOT EXISTS; this migration covers migrate-only deploys
 * and journals. Idempotent.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload"."site_settings"
    ADD COLUMN IF NOT EXISTS "realtime_enabled" boolean DEFAULT true;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload"."site_settings"
    DROP COLUMN IF EXISTS "realtime_enabled";
  `)
}
