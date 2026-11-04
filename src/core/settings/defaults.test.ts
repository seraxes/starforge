import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  DEFAULT_FORM_RATE_LIMIT_MAX,
  DEFAULT_FORM_RATE_LIMIT_WINDOW_SEC,
  FORM_RATE_LIMIT_MAX_MAX,
  FORM_RATE_LIMIT_MAX_MIN,
  FORM_RATE_LIMIT_WINDOW_SEC_MAX,
  FORM_RATE_LIMIT_WINDOW_SEC_MIN,
  clampFormRateLimitMax,
  clampFormRateLimitWindowSec,
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
