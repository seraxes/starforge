import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { validateStarforgeEnv } from './validate'

const baseProd: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://starforge:starforge@127.0.0.1:5432/starforge',
  PAYLOAD_SECRET: 'x'.repeat(32),
  BETTER_AUTH_SECRET: 'y'.repeat(32),
  BETTER_AUTH_URL: 'https://starforge.example',
  NEXT_PUBLIC_APP_URL: 'https://starforge.example',
  SF_PAY_CREDENTIALS_KEY: 'z'.repeat(40),
}

describe('validateStarforgeEnv', () => {
  it('accepts a complete production env', () => {
    const result = validateStarforgeEnv(baseProd)
    assert.equal(result.ok, true)
    assert.equal(result.errors.length, 0)
  })

  it('errors when production secrets are short', () => {
    const result = validateStarforgeEnv({
      ...baseProd,
      PAYLOAD_SECRET: 'short',
    })
    assert.equal(result.ok, false)
    assert.ok(result.errors.some((e) => e.key === 'PAYLOAD_SECRET'))
  })

  it('errors when redis cache selected without REDIS_URL', () => {
    const result = validateStarforgeEnv({
      ...baseProd,
      STARFORGE_CONTENT_CACHE: 'redis',
    })
    assert.equal(result.ok, false)
    assert.ok(result.errors.some((e) => e.key === 'REDIS_URL'))
  })

  it('errors when s3 selected without S3_* (no silent fallback)', () => {
    const result = validateStarforgeEnv({
      ...baseProd,
      STARFORGE_MEDIA_STORAGE: 's3',
    })
    assert.equal(result.ok, false)
    assert.ok(result.errors.some((e) => e.key === 'S3_BUCKET'))
  })

  it('warns in development when DATABASE_URL is missing', () => {
    const result = validateStarforgeEnv({
      NODE_ENV: 'development',
    })
    assert.equal(result.ok, true)
    assert.ok(result.warnings.some((w) => w.key === 'DATABASE_URL'))
  })

  it('allows production http when STARFORGE_SECURE_COOKIES=0', () => {
    const result = validateStarforgeEnv({
      ...baseProd,
      BETTER_AUTH_URL: 'http://localhost:3000',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      STARFORGE_SECURE_COOKIES: '0',
    })
    assert.equal(result.ok, true)
  })

  it('warns when STARFORGE_DEVELOPER_ADMIN_EMAILS is empty (fail-closed in prod)', () => {
    const result = validateStarforgeEnv(baseProd)
    assert.equal(result.ok, true)
    const warn = result.warnings.find((w) => w.key === 'STARFORGE_DEVELOPER_ADMIN_EMAILS')
    assert.ok(warn)
    assert.match(warn!.message, /fail-closed/)
  })

  it('accepts a long random production secret', () => {
    const result = validateStarforgeEnv({
      ...baseProd,
      PAYLOAD_SECRET: 'a7f3c9e1b2d4f6a8c0e2b4d6f8a0c2e4',
      BETTER_AUTH_SECRET: '9b1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a',
    })
    assert.equal(result.ok, true)
    assert.equal(
      result.errors.filter(
        (e) => e.key === 'PAYLOAD_SECRET' || e.key === 'BETTER_AUTH_SECRET',
      ).length,
      0,
    )
  })

  it('errors in production when PAYLOAD_SECRET is the .env.example placeholder', () => {
    const result = validateStarforgeEnv({
      ...baseProd,
      PAYLOAD_SECRET: 'dev-only-change-me-to-a-long-random-string',
    })
    assert.equal(result.ok, false)
    assert.ok(
      result.errors.some(
        (e) => e.key === 'PAYLOAD_SECRET' && /placeholder/i.test(e.message),
      ),
    )
  })

  it('errors in production when BETTER_AUTH_SECRET is the .env.example placeholder', () => {
    const result = validateStarforgeEnv({
      ...baseProd,
      BETTER_AUTH_SECRET: 'dev-only-better-auth-secret-change-me',
    })
    assert.equal(result.ok, false)
    assert.ok(
      result.errors.some(
        (e) => e.key === 'BETTER_AUTH_SECRET' && /placeholder/i.test(e.message),
      ),
    )
  })

  it('does not flag CI workflow secrets as placeholders', () => {
    const result = validateStarforgeEnv({
      ...baseProd,
      PAYLOAD_SECRET: 'ci-only-payload-secret-32chars-min',
      BETTER_AUTH_SECRET: 'ci-only-better-auth-secret-32chars',
    })
    assert.equal(result.ok, true)
    assert.equal(
      result.errors.filter(
        (e) => e.key === 'PAYLOAD_SECRET' || e.key === 'BETTER_AUTH_SECRET',
      ).length,
      0,
    )
  })

  it('adds no STARFORGE_TRUSTED_PROXY_HOPS warning when production sets hops=1', () => {
    const result = validateStarforgeEnv({
      ...baseProd,
      STARFORGE_TRUSTED_PROXY_HOPS: '1',
    })
    assert.equal(result.ok, true)
    assert.equal(
      result.warnings.filter((w) => w.key === 'STARFORGE_TRUSTED_PROXY_HOPS').length,
      0,
    )
    assert.equal(
      result.errors.filter((e) => e.key === 'STARFORGE_TRUSTED_PROXY_HOPS').length,
      0,
    )
  })

  it('warns (not errors) when production leaves STARFORGE_TRUSTED_PROXY_HOPS unset', () => {
    const result = validateStarforgeEnv(baseProd)
    assert.equal(result.ok, true)
    const warn = result.warnings.find((w) => w.key === 'STARFORGE_TRUSTED_PROXY_HOPS')
    assert.ok(warn)
    assert.equal(warn!.level, 'warn')
    assert.equal(
      result.errors.filter((e) => e.key === 'STARFORGE_TRUSTED_PROXY_HOPS').length,
      0,
    )
  })

  it('accepts production with a long dedicated SF_PAY_CREDENTIALS_KEY', () => {
    const result = validateStarforgeEnv({
      ...baseProd,
      SF_PAY_CREDENTIALS_KEY: 'prod-pay-credentials-dedicated-key-a1b2c3d4e5f6',
    })
    assert.equal(result.ok, true)
    assert.equal(
      result.errors.filter((e) => e.key === 'SF_PAY_CREDENTIALS_KEY').length,
      0,
    )
  })

  it('errors in production when SF_PAY_CREDENTIALS_KEY is missing', () => {
    const withoutPayKey: NodeJS.ProcessEnv = { ...baseProd }
    delete withoutPayKey.SF_PAY_CREDENTIALS_KEY
    const result = validateStarforgeEnv(withoutPayKey)
    assert.equal(result.ok, false)
    assert.ok(
      result.errors.some(
        (e) => e.key === 'SF_PAY_CREDENTIALS_KEY' && /required/i.test(e.message),
      ),
    )
  })

  it('errors in production when SF_PAY_CREDENTIALS_KEY is the hardcoded fallback', () => {
    const result = validateStarforgeEnv({
      ...baseProd,
      SF_PAY_CREDENTIALS_KEY: 'dev-only-payments-credentials-key',
    })
    assert.equal(result.ok, false)
    assert.ok(
      result.errors.some(
        (e) => e.key === 'SF_PAY_CREDENTIALS_KEY' && /placeholder/i.test(e.message),
      ),
    )
  })
})
