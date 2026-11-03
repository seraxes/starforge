/**
 * Smoke check: Secure-cookie signal + baseline security headers (SF-129).
 * Run: npx tsx scripts/verify-security-headers-cookies.mts
 */
import { buildSecurityHeaders } from '../src/core/security/headers.ts'
import { shouldUseSecureCookies } from '../src/core/security/secure-cookies.ts'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error(msg)
    process.exit(1)
  }
}

const saved = {
  STARFORGE_SECURE_COOKIES: process.env.STARFORGE_SECURE_COOKIES,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NODE_ENV: process.env.NODE_ENV,
}

function restore(): void {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
}

try {
  delete process.env.STARFORGE_SECURE_COOKIES
  process.env.BETTER_AUTH_URL = 'http://localhost:3000'
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
  assert(shouldUseSecureCookies() === false, 'http://localhost must keep Secure cookies off')

  process.env.BETTER_AUTH_URL = 'https://starforge.example'
  assert(shouldUseSecureCookies() === true, 'https:// BETTER_AUTH_URL must enable Secure cookies')

  process.env.STARFORGE_SECURE_COOKIES = '0'
  assert(shouldUseSecureCookies() === false, 'STARFORGE_SECURE_COOKIES=0 must override https URL')

  process.env.STARFORGE_SECURE_COOKIES = '1'
  process.env.BETTER_AUTH_URL = 'http://localhost:3000'
  assert(shouldUseSecureCookies() === true, 'STARFORGE_SECURE_COOKIES=1 must force Secure cookies')

  delete process.env.STARFORGE_SECURE_COOKIES
  process.env.BETTER_AUTH_URL = 'https://starforge.example'
  const withHsts = buildSecurityHeaders()
  const keys = new Set(withHsts.map((h) => h.key))
  for (const required of [
    'Content-Security-Policy',
    'X-Frame-Options',
    'X-Content-Type-Options',
    'Referrer-Policy',
    'Permissions-Policy',
    'Strict-Transport-Security',
  ]) {
    assert(keys.has(required), `missing header ${required} on HTTPS path`)
  }
  assert(
    withHsts.find((h) => h.key === 'X-Frame-Options')?.value === 'SAMEORIGIN',
    'X-Frame-Options must be SAMEORIGIN',
  )

  const noHsts = buildSecurityHeaders({ hsts: false })
  assert(
    !noHsts.some((h) => h.key === 'Strict-Transport-Security'),
    'HSTS must be omitable for local HTTP',
  )

  console.log('ok — Secure cookies signal + security headers baseline')
} finally {
  restore()
}
