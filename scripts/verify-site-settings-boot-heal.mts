/**
 * Lock: site_settings select heal runs at boot before Payload findGlobal/update.
 * Run: npx tsx scripts/verify-site-settings-boot-heal.mts
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  SITE_SETTINGS_HEAL_VERIFY_COLUMNS,
  SITE_SETTINGS_SCHEMA_HEAL_SQL,
} from '../src/core/settings/heal-site-settings-schema.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function must(cond: unknown, message: string): asserts cond {
  if (!cond) {
    console.error(message)
    process.exit(1)
  }
}

must(
  SITE_SETTINGS_SCHEMA_HEAL_SQL.includes('dashboard_refresh_interval_sec'),
  'heal SQL must include dashboard_refresh_interval_sec',
)
must(
  SITE_SETTINGS_SCHEMA_HEAL_SQL.includes('dashboard_online_window_min'),
  'heal SQL must include dashboard_online_window_min',
)
must(
  SITE_SETTINGS_HEAL_VERIFY_COLUMNS.includes('dashboard_refresh_interval_sec'),
  'verify columns must include dashboard_refresh_interval_sec',
)

const settingsIndex = readFileSync(join(root, 'src/core/settings/index.ts'), 'utf8')
must(
  settingsIndex.includes('ensureSiteSettingsSchemaHealed'),
  'settings/index.ts must import/call ensureSiteSettingsSchemaHealed',
)
must(
  /ensureSiteSettingsDefaults[\s\S]*?await ensureSiteSettingsSchemaHealed\(\)/.test(
    settingsIndex,
  ),
  'ensureSiteSettingsDefaults must await ensureSiteSettingsSchemaHealed before Payload',
)
must(
  /updateSiteSettings[\s\S]*?await ensureSiteSettingsSchemaHealed\(\)/.test(settingsIndex),
  'updateSiteSettings must await ensureSiteSettingsSchemaHealed before Payload',
)
must(
  /loadSiteSettingsUncached[\s\S]*?await ensureSiteSettingsSchemaHealed\(\)/.test(
    settingsIndex,
  ),
  'loadSiteSettingsUncached must await ensureSiteSettingsSchemaHealed before Payload',
)

const migrate = readFileSync(join(root, 'scripts/db-migrate.mts'), 'utf8')
must(
  migrate.includes('heal-site-settings-schema'),
  'db-migrate.mts must reuse heal-site-settings-schema',
)
must(
  migrate.includes('healSiteSettingsSchema'),
  'db-migrate.mts must call healSiteSettingsSchema',
)

console.log('ok: site_settings boot heal wired (ensure/update/load + migrate SQL share)')
