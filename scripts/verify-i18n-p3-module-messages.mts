/**
 * Smoke checks for multilang P3 — module message contract.
 * Run: npx tsx scripts/verify-i18n-p3-module-messages.mts
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8')
}

assert.equal(
  existsSync(join(root, 'src/modules/MESSAGES.md')),
  true,
  'src/modules/MESSAGES.md contract note required',
)

const defineModule = read('src/core/modules/define-module.ts')
assert.match(defineModule, /i18n\?:\s*StarforgeModuleI18nDecl/)
assert.match(defineModule, /StarforgeModuleI18nDecl/)
assert.match(defineModule, /namespaces:\s*string\[\]/)
console.log('manifest i18n hook: ok')

const merge = read('src/core/i18n/merge-messages.ts')
assert.match(merge, /export function mergeMessageTrees/)
assert.match(merge, /export function wrapModuleMessages/)
const loadMessages = read('src/core/i18n/load-messages.ts')
assert.match(loadMessages, /moduleMessageLoaders/)
assert.match(loadMessages, /isCatalogModuleEnabled/)
assert.match(loadMessages, /loadMergedMessages/)
assert.match(loadMessages, /from '@\/generated\/module-registry\.server'/)
assert.doesNotMatch(loadMessages, /from '@\/modules\//)
console.log('Core merge host (no @/modules imports): ok')

const request = read('src/core/i18n/request.ts')
assert.match(request, /loadMergedMessages/)
console.log('request.ts uses loadMergedMessages: ok')

const generate = read('scripts/generate-module-registry.mts')
assert.match(generate, /discoverModuleMessagePacks/)
assert.match(generate, /moduleMessageLoaders/)
assert.match(generate, /messages\/<locale>\.json|messagesDir/)
console.log('modules:generate discovers message packs: ok')

for (const pack of [
  'consent',
  'forms',
  'email-manager',
] as const) {
  for (const locale of ['en', 'hu'] as const) {
    const rel = `src/modules/${pack}/messages/${locale}.json`
    assert.equal(existsSync(join(root, rel)), true, `${rel} required`)
  }
}
console.log('consent/forms/email-manager message packs: ok')

const consentManifest = read('src/modules/consent/manifest.ts')
assert.match(consentManifest, /namespaces:\s*\[['"]product:consent['"]\]/)
const formsManifest = read('src/modules/forms/manifest.ts')
assert.match(formsManifest, /namespaces:\s*\[['"]product:forms['"]\]/)
const emailManifest = read('src/modules/email-manager/manifest.ts')
assert.match(emailManifest, /namespaces:\s*\[['"]product:email-manager['"]\]/)
const eventsManifest = read('src/modules/events/manifest.ts')
assert.match(eventsManifest, /namespaces:\s*\[['"]product:events['"]\]/)
console.log('manifest namespaces declared: ok')

const consentBanner = read('src/modules/consent/ConsentBanner.tsx')
assert.match(consentBanner, /useTranslations\(['"]product:consent['"]\)/)
assert.match(consentBanner, /t\(['"]acceptAll['"]\)/)
assert.doesNotMatch(consentBanner, /Accept all/)
const formWidget = read('src/modules/form/FormWidget.tsx')
assert.match(formWidget, /useTranslations\(['"]product:forms['"]\)/)
assert.match(formWidget, /t\(['"]sending['"]\)/)
assert.doesNotMatch(formWidget, /Sending…/)
const emailWidget = read('src/modules/email-manager/dashboard/EmailSentWidget.tsx')
assert.match(emailWidget, /getTranslations\(['"]product:email-manager['"]\)/)
assert.match(emailWidget, /t\(['"]openManager['"]\)/)
console.log('thin UI migrations: ok')

const serverRegistry = read('src/generated/module-registry.server.ts')
assert.match(serverRegistry, /moduleMessageLoaders/)
const messageLoadersBlock = serverRegistry.slice(
  serverRegistry.indexOf('export const moduleMessageLoaders'),
)
assert.match(messageLoadersBlock, /product:consent/)
assert.match(messageLoadersBlock, /product:forms/)
assert.match(messageLoadersBlock, /product:email-manager/)
assert.doesNotMatch(
  messageLoadersBlock,
  /moduleId:\s*['"]product:events['"]/,
  'events has no messages yet — no loader',
)
console.log('generated moduleMessageLoaders: ok')

console.log('verify-i18n-p3-module-messages: pass')
