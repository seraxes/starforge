/**
 * Lock: site settings read/write stays on Core sf_site_settings.
 * Run: npx tsx scripts/verify-site-settings-boot-heal.mts
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { SITE_SETTINGS_CORE_VERIFY_COLUMNS } from '../src/core/settings/heal-site-settings-schema.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function must(cond: unknown, message: string): asserts cond {
  if (!cond) {
    console.error(message)
    process.exit(1)
  }
}

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8')
}

must(
  SITE_SETTINGS_CORE_VERIFY_COLUMNS.includes('dashboard_refresh_interval_sec'),
  'verify columns must include dashboard_refresh_interval_sec',
)
must(
  SITE_SETTINGS_CORE_VERIFY_COLUMNS.includes('realtime_enabled'),
  'verify columns must include realtime_enabled',
)
must(
  SITE_SETTINGS_CORE_VERIFY_COLUMNS.includes('module_toggles'),
  'verify columns must include module_toggles',
)

const settingsDir = read('src/core/settings/index.ts') + read('src/core/settings/store.ts') + read('src/core/settings/heal-site-settings-schema.ts')
must(!/getPayload\s*\(/.test(settingsDir), 'src/core/settings must not call getPayload')
must(!/findGlobal\s*\(/.test(settingsDir), 'src/core/settings must not call findGlobal')
must(!/updateGlobal\s*\(/.test(settingsDir), 'src/core/settings must not call updateGlobal')
must(
  /export async function updateSiteSettings[\s\S]*?await invalidateSiteSettings\(\)/.test(
    read('src/core/settings/index.ts'),
  ),
  'updateSiteSettings must await invalidateSiteSettings',
)

const migration = read('src/core/db/migrations/0043_site_settings.sql')
must(migration.includes('"sf_site_settings"'), '0043 must create sf_site_settings')
must(
  migration.includes('"payload"."site_settings"'),
  '0043 must copy payload.site_settings',
)
must(
  migration.includes('site_settings_module_toggles'),
  '0043 must copy module toggle rows',
)

const migrate = read('scripts/db-migrate.mts')
must(
  migrate.includes('0043_site_settings.sql'),
  'db-migrate.mts must replay 0043_site_settings.sql',
)
must(
  migrate.includes('sf_site_settings'),
  'db-migrate.mts must verify sf_site_settings',
)
must(
  !migrate.includes('healSiteSettingsSchema'),
  'db-migrate.mts must not heal payload.site_settings',
)

must(
  !existsSync(join(root, 'src/payload.config.ts')),
  'payload.config.ts must be gone (phase 4)',
)
must(
  migrate.includes('0048_drop_payload_schema.sql'),
  'db-migrate.mts must drop the leftover payload schema after the copy',
)
must(
  !migrate.includes('payload:migrate'),
  'db-migrate.mts must not run payload migrate',
)

console.log('ok: site settings live on sf_site_settings (no Payload config)')
