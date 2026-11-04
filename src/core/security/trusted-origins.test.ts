import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { appTrustedOrigins, hasUntrustedOrigin, payloadCsrfOrigins } from './trusted-origins'

function env( partial: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { NODE_ENV: 'test', ...partial }
}

describe('appTrustedOrigins', () => {
  it('derives production origins from BETTER_AUTH_URL + STARFORGE_TRUSTED_ORIGINS', () => {
    const origins = appTrustedOrigins(
      env({
        BETTER_AUTH_URL: 'https://starforge.example',
        STARFORGE_TRUSTED_ORIGINS: 'https://www.starforge.example, not-a-url',
      }),
    )
    assert.deepEqual(origins, ['https://starforge.example', 'https://www.starforge.example'])
  })

  it('adds localhost / 127.0.0.1 twins only for loopback app URLs', () => {
    const local = appTrustedOrigins(
      env({
        BETTER_AUTH_URL: 'http://localhost:3000',
        NEXT_PUBLIC_APP_URL: 'http://localhost:3000/',
      }),
    )
    assert.ok(local.includes('http://localhost:3000'))
    assert.ok(local.includes('http://127.0.0.1:3000'))

    const prod = appTrustedOrigins(env({ BETTER_AUTH_URL: 'https://app.example' }))
    assert.deepEqual(prod, ['https://app.example'])
    assert.ok(!prod.some((o) => o.includes('localhost')))
  })

  it('falls back to localhost when no URLs are set', () => {
    const origins = appTrustedOrigins(env({}))
    assert.ok(origins.includes('http://localhost:3000'))
  })

  it('payloadCsrfOrigins mirrors appTrustedOrigins', () => {
    const e = env({
      BETTER_AUTH_URL: 'https://starforge.example',
      STARFORGE_TRUSTED_ORIGINS: 'https://cdn.example',
    })
    assert.deepEqual(payloadCsrfOrigins(e), appTrustedOrigins(e))
  })

  it('hasUntrustedOrigin rejects foreign Origin headers', () => {
    const e = env({ BETTER_AUTH_URL: 'https://starforge.example' })
    assert.equal(
      hasUntrustedOrigin(new Headers({ origin: 'https://starforge.example' }), e),
      false,
    )
    assert.equal(hasUntrustedOrigin(new Headers({ origin: 'https://evil.example' }), e), true)
    assert.equal(hasUntrustedOrigin(new Headers(), e), false)
  })
})
