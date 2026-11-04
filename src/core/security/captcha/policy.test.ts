import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { CAPTCHA_PROVIDERS, isCaptchaProvider, isWiredCaptchaProvider } from './providers'
import { resolveFromProvider } from './policy'

describe('captcha providers catalog', () => {
  it('Settings select only exposes wired providers (none + turnstile)', () => {
    assert.deepEqual(
      CAPTCHA_PROVIDERS.map((p) => p.value),
      ['none', 'turnstile'],
    )
    assert.equal(isWiredCaptchaProvider('turnstile'), true)
    assert.equal(isWiredCaptchaProvider('recaptcha'), false)
    assert.equal(isWiredCaptchaProvider('hcaptcha'), false)
  })

  it('accepts legacy stub ids for normalize', () => {
    assert.equal(isCaptchaProvider('recaptcha'), true)
    assert.equal(isCaptchaProvider('hcaptcha'), true)
    assert.equal(isCaptchaProvider('bogus'), false)
  })
})

describe('resolveFromProvider fail-closed stubs', () => {
  it('keeps required=true for unwired recaptcha/hcaptcha (no skip)', () => {
    for (const provider of ['recaptcha', 'hcaptcha'] as const) {
      const resolved = resolveFromProvider(provider, true)
      assert.equal(resolved.required, true)
      assert.equal(resolved.provider, provider)
      assert.equal(resolved.siteKey, null)
      assert.ok(resolved.misconfiguredReason?.includes('not wired'))
    }
  })

  it('returns idle when not required', () => {
    const resolved = resolveFromProvider('turnstile', false)
    assert.equal(resolved.required, false)
    assert.equal(resolved.provider, 'none')
  })

  it('marks Turnstile misconfigured when keys missing', () => {
    const resolved = resolveFromProvider('turnstile', true, {})
    assert.equal(resolved.required, true)
    assert.equal(resolved.siteKey, null)
    assert.ok(resolved.misconfiguredReason?.includes('TURNSTILE'))
  })

  it('resolves Turnstile when both keys present', () => {
    const resolved = resolveFromProvider('turnstile', true, {
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site',
      TURNSTILE_SECRET_KEY: 'secret',
    })
    assert.equal(resolved.required, true)
    assert.equal(resolved.provider, 'turnstile')
    assert.equal(resolved.siteKey, 'site')
    assert.equal(resolved.misconfiguredReason, undefined)
  })
})
