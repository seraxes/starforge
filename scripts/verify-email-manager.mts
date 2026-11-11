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
mustExist('src/modules/email-manager/admin/EmailSendsPage.tsx')
mustExist('src/modules/email-manager/admin/email-sends-list.tsx')
mustExist('src/modules/email-manager/list-sends.ts')
mustExist('src/core/db/migrations/0002_email_manager.sql')
mustExist('src/core/db/migrations/0003_email_send_log.sql')
mustExist('src/modules/email-manager/send-log.ts')
mustExist('src/core/mail/with-send-log.ts')

const manifest = read('src/modules/email-manager/manifest.ts')
assert.match(manifest, /id: 'product:email-manager'/)
assert.match(manifest, /path: 'email'/)
assert.match(manifest, /path: 'email\/templates'/)
assert.match(manifest, /path: 'email\/sends'/)
assert.match(manifest, /label: 'Sends'/)
assert.match(manifest, /href: '\/admin\/email\/sends'/)

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

const sendsShim = read('src/app/(frontend)/admin/(modules)/email/sends/page.tsx')
assert.match(sendsShim, /@\/modules\/email-manager\/admin\/EmailSendsPage/)

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
assert.match(engine, /emailTypeFromModuleCategory/)
assert.doesNotMatch(engine, /SMTP_PASS|RESEND_API_KEY|createTransport/)

const sendLog = read('src/modules/email-manager/send-log.ts')
assert.match(sendLog, /recordEmailSend/)
assert.match(sendLog, /sfEmailSends/)

assert.match(read('src/core/mail/index.ts'), /withEmailSendLog/)

const emailNotify = read('src/modules/forms/email-notify.ts')
assert.match(emailNotify, /email-manager\/api\.server/)
assert.match(emailNotify, /viaEmailManager/)
assert.match(emailNotify, /FORM_SUBMITTED_TRIGGER/)

const toggles = read('src/core/settings/module-toggles.ts')
assert.match(toggles, /emailManager: 'product:email-manager'/)

const acl = read('src/core/acl/types.ts')
assert.match(acl, /admin\.email-manager/)

const decide = read('src/core/acl/decide.ts')
assert.match(decide, /admin\.email-manager/)
// Path may be literal `/admin/email` or `${CORE_ADMIN_BASE}/email` after remount/D0.
assert.match(decide, /(?:\$\{CORE_ADMIN_BASE\}\/email|\/admin\/email)/)

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
assert.match(
  templatesUi,
  /outlines-create admin-settings-panel-wide[\s\S]*Filter by module/,
  'Filter section must span full mosaic width',
)
assert.match(templatesUi, /sf-email-templates-card/)
assert.match(templatesUi, /sf-email-templates-card-form/)
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

const styles = read('src/app/(frontend)/styles.css')
assert.match(
  styles,
  /\.admin-settings-mosaic\.sf-email-templates-manager > \.outlines-create\.sf-email-templates-card/,
  'templates mosaic must let Test send / Add template share a 2-col row',
)
assert.match(
  styles,
  /sf-email-templates-card-form[\s\S]*grid-template-columns: minmax\(0, 1fr\)/,
  'Test send / Add template forms must be single-column inside their cards',
)

const rulesPage = read('src/modules/email-manager/admin/EmailRulesPage.tsx')
assert.match(rulesPage, /admin-section admin-layouts-full/)
assert.match(rulesPage, /getMailerInfo/)

const templatesPage = read('src/modules/email-manager/admin/EmailTemplatesPage.tsx')
assert.match(templatesPage, /admin-section admin-layouts-full/)

const sendsPage = read('src/modules/email-manager/admin/EmailSendsPage.tsx')
assert.match(sendsPage, /admin-section admin-layouts-full/)
assert.match(sendsPage, /listRecentEmailSends/)
assert.match(sendsPage, /getMailerInfo/)

const sendsUi = read('src/modules/email-manager/admin/email-sends-list.tsx')
assert.match(sendsUi, /admin-settings-mosaic/)
assert.match(sendsUi, /outlines-create/)
assert.match(sendsUi, /outlines-table-wrap admin-settings-panel-wide/)
assert.match(sendsUi, /outlines-table/)
assert.match(sendsUi, /admin-empty/)
assert.match(sendsUi, /No sends logged yet/)
assert.match(sendsUi, />When</)
assert.match(sendsUi, />To</)
assert.match(sendsUi, />Type</)
assert.match(sendsUi, />Status</)
assert.match(sendsUi, />Title</)
assert.doesNotMatch(
  sendsUi,
  /page-settings-panel(?!-)/,
  'sends UI must use outlines-create head strip, not bare page-settings-panel',
)
assert.doesNotMatch(
  sendsUi,
  /admin-table-wrap/,
  'sends list must not nest admin-table-wrap inside outlines-table-wrap',
)

const emailNav = read('src/modules/email-manager/admin/email-admin-nav.tsx')
assert.match(emailNav, /id: 'sends'/)
assert.match(emailNav, /href: '\/admin\/email\/sends'/)

const listSends = read('src/modules/email-manager/list-sends.ts')
assert.match(listSends, /listRecentEmailSends/)
assert.match(listSends, /sfEmailSends/)
assert.match(listSends, /unavailable/)

// /admin/email calls getMailerInfo → resolveFrom; chromeFrom may be undefined.
const resolveFromSrc = read('src/core/mail/resolve-from.ts')
assert.match(
  resolveFromSrc,
  /\(chromeFrom\s*\?\?\s*['"]{2}\)\s*\.trim\(\)/,
  'resolveFrom must guard chromeFrom before trim (Site Chrome From can be missing)',
)
const mailIndex = read('src/core/mail/index.ts')
assert.match(mailIndex, /from ['"]\.\/resolve-from['"]/)

console.log('verify:email-manager OK')
