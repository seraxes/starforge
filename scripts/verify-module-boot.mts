/**
 * Stage 6 boot check.
 * Source: instrumentation names no pack, generated loaders are in order.
 * Runtime: with the catalog toggles on, boot registers the event preset,
 * the Subscriptions collect resolver, the Email Manager broadcast job,
 * and the Events abandoned-checkout sweep. With Events forced off, the
 * sweep global stays unset.
 *
 * Run: npm run verify:module-boot
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function read(rel: string): string {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

function loadEnv(file: string): void {
  const full = path.join(ROOT, file)
  if (!existsSync(full)) return
  for (const line of readFileSync(full, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    if (process.env[key] !== undefined) continue
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

function bootLoaderIds(serverRegistry: string): string[] {
  const start = serverRegistry.indexOf('export const bootLoaders')
  const end = serverRegistry.indexOf('export async function runModuleBoot')
  assert.ok(start >= 0 && end > start, 'generated registry is missing bootLoaders / runModuleBoot')
  return [...serverRegistry.slice(start, end).matchAll(/moduleId: "([^"]+)"/g)].map(
    (match) => match[1] ?? '',
  )
}

loadEnv('.env')
loadEnv('.env.local')

const instrumentation = read('src/instrumentation.ts')
assert.equal(instrumentation.includes('modules/events'), false)
assert.equal(instrumentation.includes('modules/subscriptions'), false)
assert.equal(instrumentation.includes('modules/email-manager'), false)
assert.match(instrumentation, /NEXT_RUNTIME === 'edge'/)
assert.match(instrumentation, /runModuleBoot\(\)/)
const edgeAt = instrumentation.indexOf("process.env.NEXT_RUNTIME === 'edge'")
const bootAt = instrumentation.indexOf('runModuleBoot')
assert.ok(edgeAt >= 0 && bootAt > edgeAt, 'edge guard must return before Node boot')

const paymentsManifest = read('src/modules/payments/manifest.ts')
const formsManifest = read('src/modules/forms/manifest.ts')
assert.equal(paymentsManifest.includes('boot:'), false)
assert.equal(formsManifest.includes('boot:'), false)

for (const [rel, exportName] of [
  ['src/modules/email-manager/manifest.ts', 'bootEmailManager'],
  ['src/modules/events/manifest.ts', 'bootEvents'],
  ['src/modules/subscriptions/manifest.ts', 'bootSubscriptions'],
  ['src/modules/profiles/manifest.ts', 'bootProfiles'],
] as const) {
  const manifest = read(rel)
  assert.match(manifest, new RegExp(`exportName: '${exportName}'`))
}

const serverRegistry = read('src/generated/module-registry.server.ts')
assert.deepEqual(bootLoaderIds(serverRegistry), [
  'product:email-manager',
  'product:profiles',
  'product:events',
  'product:subscriptions',
])

type SweepGlobal = typeof globalThis & {
  __sfEventsAbandonedCheckoutSweep?: boolean
}

const { bootEvents } = await import('../src/modules/events/boot.ts')
const sweepGlobal = globalThis as SweepGlobal
delete sweepGlobal.__sfEventsAbandonedCheckoutSweep
await bootEvents({ isEnabled: async () => false })
assert.equal(
  sweepGlobal.__sfEventsAbandonedCheckoutSweep,
  undefined,
  'Events disabled: abandoned-checkout sweep global must stay unset',
)

const { runModuleBoot } = await import('../src/generated/module-registry.server.ts')
const { MODULE_IDS, getSiteSettingsLive, isCatalogModuleEnabled } = await import(
  '../src/core/settings/index.ts'
)
const settings = await getSiteSettingsLive()
const toggles = {
  email: isCatalogModuleEnabled(settings, MODULE_IDS.emailManager),
  profiles: isCatalogModuleEnabled(settings, MODULE_IDS.profiles),
  events: isCatalogModuleEnabled(settings, MODULE_IDS.events),
  subscriptions: isCatalogModuleEnabled(settings, MODULE_IDS.subscriptions),
}
assert.deepEqual(toggles, {
  email: true,
  profiles: true,
  events: true,
  subscriptions: true,
})

const bootErrors: unknown[][] = []
const originalConsoleError = console.error
console.error = (...args: unknown[]) => {
  bootErrors.push(args)
  originalConsoleError(...args)
}
try {
  await runModuleBoot()
  await new Promise((resolve) => setTimeout(resolve, 50))
} finally {
  console.error = originalConsoleError
}
assert.deepEqual(
  bootErrors,
  [],
  `module boot logged errors: ${bootErrors.map((args) => args.map(String).join(' ')).join(' | ')}`,
)

const { getRegisteredFormPreset } = await import('@/modules/forms/api')
const { getJobHandler } = await import('@/core/jobs/handlers')
const { isCollectCapabilityResolverRegistered } = await import('@/modules/payments/api')
const { EMAIL_BROADCAST_DRAIN_JOB } = await import('@/modules/email-manager/broadcast')

assert.ok(getRegisteredFormPreset('event-registration'), 'event preset was not registered')
assert.equal(isCollectCapabilityResolverRegistered(), true, 'collect resolver was not registered')
assert.ok(getJobHandler(EMAIL_BROADCAST_DRAIN_JOB), 'broadcast drain job was not registered')
assert.equal(
  sweepGlobal.__sfEventsAbandonedCheckoutSweep,
  true,
  'abandoned-checkout sweep was not armed',
)

console.log(
  'verify-module-boot: pass (email → profiles → events → subscriptions; preset, collect resolver, broadcast job, sweep armed; Events-off sweep global unset)',
)
process.exit(0)
