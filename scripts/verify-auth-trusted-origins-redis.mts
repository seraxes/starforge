/**
 * Smoke checks for env-driven Better Auth trustedOrigins + Redis secondaryStorage.
 * Run: npx tsx scripts/verify-auth-trusted-origins-redis.mts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { appTrustedOrigins } from '../src/core/security/trusted-origins.ts'
import { authSecondaryStorageKey } from '../src/core/auth/secondary-storage.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8')
}

const authIndex = read('src/core/auth/index.ts')
assert.match(authIndex, /appTrustedOrigins/)
assert.doesNotMatch(
  authIndex,
  /trustedOrigins:\s*\[\s*['"]http:\/\/localhost:3000['"]/,
  'auth must not hardcode localhost-only trustedOrigins',
)
assert.match(authIndex, /createRedisSecondaryStorage/)
assert.match(authIndex, /secondary-storage/)
assert.match(authIndex, /storeSessionInDatabase:\s*true/)
assert.match(authIndex, /REDIS_URL/)
console.log('auth/index wires env trustedOrigins + Redis secondaryStorage: ok')

const catalog = read('src/core/env-editor/catalog.ts')
assert.match(catalog, /STARFORGE_TRUSTED_ORIGINS/)
assert.match(catalog, /Better Auth/)
assert.match(catalog, /REDIS_URL/)
assert.match(catalog, /secondaryStorage/)
console.log('Environment catalog documents origins + Redis auth: ok')

const prod = appTrustedOrigins({
  BETTER_AUTH_URL: 'https://starforge.example',
  STARFORGE_TRUSTED_ORIGINS: 'https://www.starforge.example',
} as NodeJS.ProcessEnv)
assert.deepEqual(prod, ['https://starforge.example', 'https://www.starforge.example'])
assert.ok(!prod.some((o) => o.includes('localhost')))
console.log('prod trustedOrigins omit localhost: ok')

const savedPrefix = process.env.STARFORGE_REDIS_PREFIX
process.env.STARFORGE_REDIS_PREFIX = 'sf:verify'
try {
  assert.equal(authSecondaryStorageKey('x'), 'sf:verify:ba:x')
} finally {
  if (savedPrefix === undefined) delete process.env.STARFORGE_REDIS_PREFIX
  else process.env.STARFORGE_REDIS_PREFIX = savedPrefix
}
console.log('Better Auth Redis key prefix :ba:: ok')

console.log('verify-auth-trusted-origins-redis: all ok')
