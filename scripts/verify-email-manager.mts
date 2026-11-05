/**
 * Smoke: product:email-manager pack — rules/templates admin, Mailer reuse, Forms emit.
 * Run: npm run verify:email-manager
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

mustExist('src/modules/email-manager/manifest.ts')
mustExist('src/modules/email-manager/api.ts')
mustExist('src/modules/email-manager/api.server.ts')
mustExist('src/modules/email-manager/schema.ts')
mustExist('src/modules/email-manager/engine.ts')
mustExist('src/modules/email-manager/store.ts')
mustExist('src/modules/email-manager/admin/EmailRulesPage.tsx')
mustExist('src/modules/email-manager/admin/EmailTemplatesPage.tsx')
mustExist('src/core/db/migrations/0002_email_manager.sql')

const manifest = read('src/modules/email-manager/manifest.ts')
assert.match(manifest, /id: 'product:email-manager'/)
assert.match(manifest, /path: 'email'/)
assert.match(manifest, /path: 'email\/templates'/)

const allowlist = read('starforge.modules.json')
assert.match(allowlist, /product:email-manager/)

const registry = read('src/generated/module-registry.ts')
assert.match(registry, /product:email-manager/)

const rulesShim = read('src/app/(frontend)/admin/(modules)/email/page.tsx')
assert.match(rulesShim, /@\/modules\/email-manager\/admin\/EmailRulesPage/)

const templatesShim = read(
  'src/app/(frontend)/admin/(modules)/email/templates/page.tsx',
)
assert.match(templatesShim, /@\/modules\/email-manager\/admin\/EmailTemplatesPage/)

const api = read('src/modules/email-manager/api.ts')
assert.match(api, /FORM_SUBMITTED_TRIGGER/)
assert.match(api, /listEmailTriggers/)
assert.doesNotMatch(
  api,
  /^import ['"]server-only['"]/m,
  'api.ts must not import server-only (client-safe barrel)',
)

const apiServer = read('src/modules/email-manager/api.server.ts')
assert.match(apiServer, /emitEmailTrigger/)
assert.match(apiServer, /import ['"]server-only['"]/)

const engine = read('src/modules/email-manager/engine.ts')
assert.match(engine, /getMailer/)
assert.doesNotMatch(engine, /SMTP_PASS|RESEND_API_KEY|createTransport/)

const emailNotify = read('src/core/forms/email-notify.ts')
assert.match(emailNotify, /email-manager\/api\.server/)
assert.match(emailNotify, /viaEmailManager/)
assert.match(emailNotify, /FORM_SUBMITTED_TRIGGER/)

const toggles = read('src/core/settings/module-toggles.ts')
assert.match(toggles, /emailManager: 'product:email-manager'/)

const acl = read('src/core/acl/types.ts')
assert.match(acl, /admin\.email-manager/)

const decide = read('src/core/acl/decide.ts')
assert.match(decide, /\/admin\/email/)

// Runtime shells must derive contrib module ids (incl. Email) — not a hand list.
const coreAdminLayout = read('src/app/(frontend)/admin/layout.tsx')
assert.match(coreAdminLayout, /resolveEnabledAdminNavModuleIds/)
assert.match(coreAdminLayout, /ensureSiteSettingsDefaults/)

const payloadAdminNav = read('src/components/payload/StarforgeAdminNav.tsx')
assert.match(payloadAdminNav, /resolveEnabledAdminNavModuleIds/)
assert.match(payloadAdminNav, /ensureSiteSettingsDefaults/)

const enabledHelper = read('src/core/admin-nav/enabled-modules.ts')
assert.match(enabledHelper, /adminNavContributions/)
assert.match(enabledHelper, /isCatalogModuleEnabled/)

const registryNav = read('src/generated/module-registry.ts')
assert.match(
  registryNav,
  /moduleId:\s*"product:email-manager"[\s\S]*?id:\s*"email"[\s\S]*?label:\s*"Email"/,
)

// Admin UI: Page Settings / Forms mosaic language (not Layout canvas cards).
const rulesUi = read('src/modules/email-manager/admin/email-rules-manager.tsx')
assert.match(rulesUi, /admin-settings-mosaic/)
assert.match(rulesUi, /outlines-create/)
assert.match(rulesUi, /outlines-table-wrap admin-settings-panel-wide/)
assert.match(rulesUi, /outlines-table/)
assert.match(rulesUi, /admin-empty/)
assert.doesNotMatch(
  rulesUi,
  /page-settings-panel(?!-)/,
  'rules UI must use outlines-create head strip, not bare page-settings-panel',
)
assert.doesNotMatch(
  rulesUi,
  /admin-table-wrap/,
  'rules list must not nest admin-table-wrap inside outlines-table-wrap (double card chrome)',
)

const templatesUi = read('src/modules/email-manager/admin/email-templates-manager.tsx')
assert.match(templatesUi, /admin-settings-mosaic/)
assert.match(templatesUi, /outlines-create/)
assert.match(templatesUi, /outlines-table-wrap admin-settings-panel-wide/)
assert.match(templatesUi, /outlines-table/)
assert.match(templatesUi, /admin-empty/)
assert.doesNotMatch(
  templatesUi,
  /page-settings-panel(?!-)/,
  'templates UI must use outlines-create head strip, not bare page-settings-panel',
)
assert.doesNotMatch(
  templatesUi,
  /admin-table-wrap/,
  'templates list must not nest admin-table-wrap inside outlines-table-wrap',
)

const rulesPage = read('src/modules/email-manager/admin/EmailRulesPage.tsx')
assert.match(rulesPage, /admin-section admin-layouts-full/)

const templatesPage = read('src/modules/email-manager/admin/EmailTemplatesPage.tsx')
assert.match(templatesPage, /admin-section admin-layouts-full/)

console.log('verify:email-manager OK')
