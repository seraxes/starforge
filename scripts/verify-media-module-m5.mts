/**
 * Smoke: Media M5 module pack extract — UI under src/modules/media, ports Core.
 * Run: npm run verify:media-module-m5
 */
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function read(rel: string): string {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

function mustExist(rel: string) {
  assert.ok(existsSync(path.join(ROOT, rel)), `missing ${rel}`)
}

// Pack surface
mustExist('src/modules/media/manifest.ts')
mustExist('src/modules/media/api.ts')
mustExist('src/modules/media/admin/MediaLibraryPage.tsx')
mustExist('src/modules/media/admin/MediaSettingsPage.tsx')
mustExist('src/modules/media/admin/media-library.tsx')
mustExist('src/modules/media/admin/MediaPicker.tsx')
mustExist('src/modules/media/admin/MediaLightbox.tsx')
mustExist('src/modules/media/admin/MediaCategoryTree.tsx')
mustExist('src/modules/media/admin/media-settings-form.tsx')

// Thin App Router shims — codegen under admin/(modules)/ (M2 leftovers)
const libraryShim = read('src/app/(frontend)/app/admin/(modules)/media/page.tsx')
assert.match(libraryShim, /@\/modules\/media\/admin\/MediaLibraryPage/)
assert.doesNotMatch(libraryShim, /MediaLibraryClient/)

const settingsShim = read('src/app/(frontend)/app/admin/(modules)/media/settings/page.tsx')
assert.match(settingsShim, /@\/modules\/media\/admin\/MediaSettingsPage/)
assert.doesNotMatch(settingsShim, /MediaSettingsForm/)

// Ports remain Core
mustExist('src/core/media/storage/index.ts')
mustExist('src/core/media/pipeline.ts')
mustExist('src/core/media/analysis/index.ts')
mustExist('src/core/media/resolve.ts')
mustExist('src/core/media/actions.ts')

// Public API contract
const api = read('src/modules/media/api.ts')
assert.match(api, /export \{ MediaPicker/)
assert.match(api, /resolveMediaById/)
assert.match(api, /from '@\/core\/media\/resolve'/)

// Manifest required + Site Settings Modules row
const manifest = read('src/modules/media/manifest.ts')
assert.match(manifest, /id: 'product:media'/)
assert.match(manifest, /required: true/)
assert.match(manifest, /navGroup/)

// Consumers bind via module api (not Core-hosted picker)
for (const rel of [
  'src/app/(frontend)/app/admin/forms/form-builder.tsx',
  'src/app/(frontend)/app/admin/layouts/typed-particle-editors.tsx',
  'src/app/(frontend)/app/admin/breakpoints/section-styles-panel.tsx',
]) {
  const src = read(rel)
  assert.match(src, /from '@\/modules\/media\/api'/, `${rel} should import MediaPicker from module api`)
}

// Core must not import the media module pack (ESLint rule; smoke via walk)
const { readdirSync, statSync } = await import('node:fs')
const coreHits: string[] = []
function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      walk(full)
      continue
    }
    if (!/\.(ts|tsx)$/.test(name)) continue
    const src = readFileSync(full, 'utf8')
    if (/from ['"]@\/modules\/media/.test(src)) {
      coreHits.push(path.relative(ROOT, full))
    }
  }
}
walk(path.join(ROOT, 'src/core'))
assert.equal(coreHits.length, 0, `Core must not import @/modules/media:\n${coreHits.join('\n')}`)

console.log('verify-media-module-m5: pass')
