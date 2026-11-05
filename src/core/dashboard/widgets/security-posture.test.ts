import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  formatCaptchaPosture,
  formatHeadersPosture,
  formatRateLimitPosture,
} from './security-posture'

describe('security posture formatters', () => {
  it('formatCaptchaPosture: Off when disabled', () => {
    assert.equal(formatCaptchaPosture(false, 'turnstile'), 'Off')
    assert.equal(formatCaptchaPosture(false, 'none'), 'Off')
  })

  it('formatCaptchaPosture: provider label when enabled', () => {
    assert.equal(formatCaptchaPosture(true, 'turnstile'), 'Turnstile')
    assert.equal(formatCaptchaPosture(true, 'none'), 'None')
    assert.equal(formatCaptchaPosture(true, 'custom-x'), 'custom-x')
    assert.equal(formatCaptchaPosture(true, ''), 'On')
  })

  it('formatRateLimitPosture: On vs Redis', () => {
    assert.equal(formatRateLimitPosture(undefined), 'On')
    assert.equal(formatRateLimitPosture(''), 'On')
    assert.equal(formatRateLimitPosture('  '), 'On')
    assert.equal(formatRateLimitPosture('redis://127.0.0.1:6379'), 'On (Redis)')
  })

  it('formatHeadersPosture: always On', () => {
    assert.equal(formatHeadersPosture(), 'On')
  })
})
