/**
 * Smoke: Modules catalog → info/settings pages (SF-230).
 * Run: npm run verify:modules-info-settings
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function read(rel: string): string {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

function mustExist(rel: string) {
  assert.ok(existsSync(path.join(ROOT, rel)), `missing ${rel}`)
}

mustExist('src/core/settings/module-info-settings.ts')
mustExist('src/core/settings/module-info-settings.test.ts')
mustExist('src/app/(frontend)/admin/settings/modules/[moduleId]/page.tsx')

const helper = read('src/core/settings/module-info-settings.ts')
assert.match(helper, /resolveModuleInfoSettingsHref/)
assert.match(helper, /moduleInfoSettingsHref/)
assert.match(helper, /findExistingModuleSettingsHref/)
assert.match(helper, /moduleIdPathSegment/)
assert.match(helper, /adminNavContributions/)

const index = read('src/core/settings/index.ts')
assert.match(index, /resolveModuleInfoSettingsHref/)
assert.match(index, /module-info-settings/)

const page = read('src/app/(frontend)/admin/settings/modules/[moduleId]/page.tsx')
assert.match(page, /ModuleSettingsPanelHost/)
assert.match(page, /moduleIdFromPathSegment/)
assert.match(page, /listInstalledModuleCatalog/)
assert.match(page, /Info \/ Settings/)

const form = read('src/app/(frontend)/admin/settings/settings-form.tsx')
assert.match(form, /resolveModuleInfoSettingsHref/)
assert.match(form, /Info \/ Settings/)
assert.match(form, /settings-modules-info-link/)

const host = read('src/core/modules/ModuleSettingsPanelHost.tsx')
assert.match(host, /soft stub|No settings knobs/i)

const unit = read('package.json')
assert.match(unit, /module-info-settings\.test\.ts/)
assert.match(unit, /verify:modules-info-settings/)

console.log('verify-modules-info-settings: ok')
