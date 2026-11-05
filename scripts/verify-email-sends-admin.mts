/**
 * Smoke: Email Manager → Sends admin UI (send log list).
 * Run: npm run verify:email-sends-admin
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

mustExist('src/modules/email-manager/list-sends.ts')
mustExist('src/modules/email-manager/admin/EmailSendsPage.tsx')
mustExist('src/modules/email-manager/admin/email-sends-list.tsx')
mustExist('src/app/(frontend)/admin/(modules)/email/sends/page.tsx')

const manifest = read('src/modules/email-manager/manifest.ts')
assert.match(manifest, /path: 'email\/sends'/)
assert.match(manifest, /EmailSendsPage/)
assert.match(manifest, /href: '\/admin\/email\/sends'/)

const registry = read('src/generated/module-registry.ts')
assert.match(registry, /email\/sends/)
assert.match(registry, /EmailSendsPage/)

const shim = read('src/app/(frontend)/admin/(modules)/email/sends/page.tsx')
assert.match(shim, /@\/modules\/email-manager\/admin\/EmailSendsPage/)

const page = read('src/modules/email-manager/admin/EmailSendsPage.tsx')
assert.match(page, /EmailAdminNav active="sends"/)
assert.match(page, /listRecentEmailSends/)
assert.match(page, /admin-section admin-layouts-full/)

const ui = read('src/modules/email-manager/admin/email-sends-list.tsx')
assert.match(ui, /admin-settings-mosaic/)
assert.match(ui, /outlines-table/)
assert.match(ui, /admin-empty/)
assert.match(ui, /No sends logged yet/)
assert.match(ui, /When/)
assert.match(ui, /To/)
assert.match(ui, /Type/)
assert.match(ui, /Status/)
assert.match(ui, /Title/)

const nav = read('src/modules/email-manager/admin/email-admin-nav.tsx')
assert.match(nav, /'sends'/)
assert.match(nav, /\/admin\/email\/sends/)

const list = read('src/modules/email-manager/list-sends.ts')
assert.match(list, /listRecentEmailSends/)
assert.match(list, /unavailable:\s*true/)

console.log('verify:email-sends-admin OK')
