/**
 * Smoke the level-1 engine doors that do not need a running server.
 * Run: npx tsx scripts/verify-base-engines.mts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(path: string): string {
  return readFileSync(path, 'utf8')
}

const refund = read('src/modules/payments/store.ts')
assert.doesNotMatch(refund, /refunds_not_implemented/)
assert.match(refund, /issueCreditNoteForOrder/)
assert.match(refund, /product:payments\/refunded/)
assert.match(refund, /status: 'refunded'/)
assert.match(refund, /submit_modifier/)

const exportRoute = read('src/app/api/admin/forms/export/route.ts')
assert.match(exportRoute, /definitionId/)
assert.match(exportRoute, /buildFormSubmissionsCsv/)

const authMail = read('src/core/auth/mail.ts')
assert.match(authMail, /renderTransactionalMail/)
assert.match(read('src/core/mail/transactional.ts'), /export function renderTransactionalMail/)

const theme = read('src/core/admin-theme/import-active-core-chrome.ts')
assert.match(theme, /import '\.\/themes\/starforge-gantry\/load-core-chrome'/)
assert.match(theme, /getActiveAdminThemeId/)

const registry = read('src/generated/module-registry.ts')
assert.match(registry, /export const MODULE_REQUIRES/)
assert.match(registry, /"product:events":\["product:forms","product:media","product:rich-editor","product:payments","product:profiles","product:maps"\]/)

console.log('verify-base-engines: pass')
