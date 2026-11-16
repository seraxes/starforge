/**
 * Phase 4: the Payload exchange route is gone. `/cms` redirects to `/admin`.
 * Run: npx tsx scripts/verify-cms-sso.mts
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

assert.equal(existsSync(join(root, 'src/app/api/cms/exchange/route.ts')), false)
assert.equal(existsSync(join(root, 'src/payload.config.ts')), false)

const proxy = readFileSync(join(root, 'src/proxy.ts'), 'utf8')
assert.match(proxy, /pathname === '\/cms' \|\| pathname\.startsWith\('\/cms\/'\)/)
assert.match(proxy, /NextResponse\.redirect\(new URL\('\/admin'/)
assert.doesNotMatch(proxy, /\/api\/cms\/exchange/)
assert.doesNotMatch(proxy, /getPayload/)

console.log('verify-cms-sso: /cms redirects to /admin, exchange route is gone')
