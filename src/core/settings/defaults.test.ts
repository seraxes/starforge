import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  DEFAULT_FORM_RATE_LIMIT_MAX,
  DEFAULT_FORM_RATE_LIMIT_WINDOW_SEC,
  DEFAULT_NULL_MISS_TTL_SEC,
  DEFAULT_PUBLISHED_CACHE_ENABLED,
  DEFAULT_PUBLISHED_CACHE_TTL_SEC,
  FORM_RATE_LIMIT_MAX_MAX,
  FORM_RATE_LIMIT_MAX_MIN,
  FORM_RATE_LIMIT_WINDOW_SEC_MAX,
  FORM_RATE_LIMIT_WINDOW_SEC_MIN,
  NULL_MISS_TTL_SEC_MAX,
  NULL_MISS_TTL_SEC_MIN,
  PUBLISHED_CACHE_TTL_SEC_MAX,
  PUBLISHED_CACHE_TTL_SEC_MIN,
  clampFormRateLimitMax,
  clampFormRateLimitWindowSec,
  clampNullMissTtlSec,
  clampPublishedCacheTtlSec,
  coercePublishedCacheEnabled,
} from './defaults'

describe('form rate-limit Site Settings clamps', () => {
  it('defaults when raw is missing or non-finite', () => {
    assert.equal(clampFormRateLimitMax(undefined), DEFAULT_FORM_RATE_LIMIT_MAX)
    assert.equal(clampFormRateLimitMax('nope'), DEFAULT_FORM_RATE_LIMIT_MAX)
    assert.equal(clampFormRateLimitWindowSec(null), DEFAULT_FORM_RATE_LIMIT_WINDOW_SEC)
    assert.equal(clampFormRateLimitWindowSec(Number.NaN), DEFAULT_FORM_RATE_LIMIT_WINDOW_SEC)
  })

  it('clamps max to inclusive bounds', () => {
    assert.equal(clampFormRateLimitMax(0), FORM_RATE_LIMIT_MAX_MIN)
    assert.equal(clampFormRateLimitMax(8), 8)
    assert.equal(clampFormRateLimitMax(999), FORM_RATE_LIMIT_MAX_MAX)
  })

  it('clamps window seconds to inclusive bounds', () => {
    assert.equal(clampFormRateLimitWindowSec(1), FORM_RATE_LIMIT_WINDOW_SEC_MIN)
    assert.equal(clampFormRateLimitWindowSec(60), 60)
    assert.equal(clampFormRateLimitWindowSec(99_999), FORM_RATE_LIMIT_WINDOW_SEC_MAX)
  })
})

describe('published-content cache Site Settings clamps', () => {
  it('coerces enable flag with default true', () => {
    assert.equal(coercePublishedCacheEnabled(undefined), DEFAULT_PUBLISHED_CACHE_ENABLED)
    assert.equal(coercePublishedCacheEnabled(null), DEFAULT_PUBLISHED_CACHE_ENABLED)
    assert.equal(coercePublishedCacheEnabled(true), true)
    assert.equal(coercePublishedCacheEnabled(false), false)
    assert.equal(coercePublishedCacheEnabled('on'), true)
    assert.equal(coercePublishedCacheEnabled('off'), false)
    assert.equal(coercePublishedCacheEnabled(0), false)
  })

  it('clamps published TTL (0 = tag-only)', () => {
    assert.equal(clampPublishedCacheTtlSec(undefined), DEFAULT_PUBLISHED_CACHE_TTL_SEC)
    assert.equal(clampPublishedCacheTtlSec(-5), PUBLISHED_CACHE_TTL_SEC_MIN)
    assert.equal(clampPublishedCacheTtlSec(300), 300)
    assert.equal(clampPublishedCacheTtlSec(999_999), PUBLISHED_CACHE_TTL_SEC_MAX)
  })

  it('clamps null-miss TTL', () => {
    assert.equal(clampNullMissTtlSec(undefined), DEFAULT_NULL_MISS_TTL_SEC)
    assert.equal(clampNullMissTtlSec(0), NULL_MISS_TTL_SEC_MIN)
    assert.equal(clampNullMissTtlSec(60), 60)
    assert.equal(clampNullMissTtlSec(99_999), NULL_MISS_TTL_SEC_MAX)
  })
})
