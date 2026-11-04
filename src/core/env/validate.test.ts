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
})
