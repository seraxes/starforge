import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  SITE_SETTINGS_CORE_VERIFY_COLUMNS,
  ensureSiteSettingsSchemaHealed,
  healSiteSettingsSchema,
} from './heal-site-settings-schema'

const migrationSql = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    '../db/migrations/0043_site_settings.sql',
  ),
  'utf8',
)

describe('site settings Core migration', () => {
  it('copies payload.site_settings once and does not clobber a copied row', () => {
    assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS "sf_site_settings"/)
    assert.match(migrationSql, /"payload"\."site_settings"/)
    assert.match(migrationSql, /"payload"\."site_settings_module_toggles"/)
    assert.match(migrationSql, /"payload"\."site_settings_primary_nav"/)
    assert.match(migrationSql, /"payload_copied_at" IS NOT NULL/)
    assert.match(migrationSql, /ON CONFLICT \("id"\) DO UPDATE/)
    assert.match(migrationSql, /WHERE "sf_site_settings"\."payload_copied_at" IS NULL/)
  })

  it('verify list covers performance, dashboard, and module toggles', () => {
    for (const col of [
      'form_rate_limit_max',
      'published_cache_enabled',
      'null_miss_ttl_sec',
      'dashboard_refresh_interval_sec',
      'dashboard_online_window_min',
      'realtime_enabled',
      'feature_registration',
      'module_toggles',
      'legacy_primary_nav',
    ]) {
      assert.ok(
        (SITE_SETTINGS_CORE_VERIFY_COLUMNS as readonly string[]).includes(col),
        `missing verify column ${col}`,
      )
    }
  })

  it('does not heal Payload columns', async () => {
    assert.deepEqual(await healSiteSettingsSchema(), { healed: false, skipped: true })
    assert.deepEqual(await ensureSiteSettingsSchemaHealed(), {
      healed: false,
      skipped: true,
    })
  })
})
