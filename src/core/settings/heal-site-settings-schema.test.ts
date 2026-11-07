import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  SITE_SETTINGS_HEAL_VERIFY_COLUMNS,
  SITE_SETTINGS_SCHEMA_HEAL_SQL,
  healSiteSettingsSchema,
} from './heal-site-settings-schema'

describe('site_settings schema heal SQL', () => {
  it('includes Dashboard D0 + Performance + feature columns', () => {
    const required = [
      'dashboard_refresh_interval_sec',
      'dashboard_online_window_min',
      'form_rate_limit_max',
      'form_rate_limit_window_sec',
      'published_cache_enabled',
      'published_cache_ttl_sec',
      'null_miss_ttl_sec',
      'realtime_enabled',
      'feature_registration',
      'feature_modules',
      'feature_draft_preview',
      'admin_autosave_debounce_ms',
      'site_settings_module_toggles',
    ]
    for (const col of required) {
      assert.match(
        SITE_SETTINGS_SCHEMA_HEAL_SQL,
        new RegExp(`"${col}"`),
        `heal SQL missing ${col}`,
      )
    }
  })

  it('verify list matches Dashboard + Performance columns migrate checks', () => {
    assert.ok(
      SITE_SETTINGS_HEAL_VERIFY_COLUMNS.includes('dashboard_refresh_interval_sec'),
    )
    assert.ok(
      SITE_SETTINGS_HEAL_VERIFY_COLUMNS.includes('dashboard_online_window_min'),
    )
    assert.ok(SITE_SETTINGS_HEAL_VERIFY_COLUMNS.includes('form_rate_limit_max'))
  })

  it('skips when site_settings table is missing', async () => {
    const result = await healSiteSettingsSchema({
      query: async () => ({
        rows: [{ exists: false }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      }),
    })
    assert.deepEqual(result, { healed: false, skipped: true })
  })

  it('runs heal SQL when table exists', async () => {
    const calls: string[] = []
    const result = await healSiteSettingsSchema({
      query: async (text) => {
        calls.push(text)
        if (text.includes('information_schema.tables')) {
          return {
            rows: [{ exists: true }],
            command: 'SELECT',
            rowCount: 1,
            oid: 0,
            fields: [],
          }
        }
        return {
          rows: [],
          command: 'ALTER',
          rowCount: 0,
          oid: 0,
          fields: [],
        }
      },
    })
    assert.deepEqual(result, { healed: true, skipped: false })
    assert.equal(calls.length, 2)
    assert.match(calls[1] ?? '', /dashboard_refresh_interval_sec/)
  })
})
