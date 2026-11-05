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

const rulesShim = read('src/app/(frontend)/app/admin/(modules)/email/page.tsx')
assert.match(rulesShim, /@\/modules\/email-manager\/admin\/EmailRulesPage/)

const templatesShim = read(
  'src/app/(frontend)/app/admin/(modules)/email/templates/page.tsx',
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
assert.match(decide, /\/app\/admin\/email/)

// Runtime shells must gate Email into enabledModuleIds (codegen alone is not enough).
const coreAdminLayout = read('src/app/(frontend)/app/admin/layout.tsx')
assert.match(coreAdminLayout, /MODULE_IDS\.emailManager/)
assert.match(
  coreAdminLayout,
  /enabledModuleIds\.add\(\s*MODULE_IDS\.emailManager\s*\)/,
)

const payloadAdminNav = read('src/components/payload/StarforgeAdminNav.tsx')
assert.match(payloadAdminNav, /MODULE_IDS\.emailManager/)
assert.match(
  payloadAdminNav,
  /enabledModuleIds\.add\(\s*MODULE_IDS\.emailManager\s*\)/,
)

const registryNav = read('src/generated/module-registry.ts')
assert.match(
  registryNav,
  /moduleId:\s*"product:email-manager"[\s\S]*?id:\s*"email"[\s\S]*?label:\s*"Email"/,
)

console.log('verify:email-manager OK')
