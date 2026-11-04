import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { clientIp, trustedProxyHops } from './client-ip'

describe('trustedProxyHops', () => {
  it('returns 0 when unset or invalid', () => {
    assert.equal(trustedProxyHops({}), 0)
    assert.equal(trustedProxyHops({ STARFORGE_TRUSTED_PROXY_HOPS: '' }), 0)
    assert.equal(trustedProxyHops({ STARFORGE_TRUSTED_PROXY_HOPS: 'nope' }), 0)
    assert.equal(trustedProxyHops({ STARFORGE_TRUSTED_PROXY_HOPS: '-1' }), 0)
  })

  it('parses non-negative integers', () => {
    assert.equal(trustedProxyHops({ STARFORGE_TRUSTED_PROXY_HOPS: '0' }), 0)
    assert.equal(trustedProxyHops({ STARFORGE_TRUSTED_PROXY_HOPS: '1' }), 1)
    assert.equal(trustedProxyHops({ STARFORGE_TRUSTED_PROXY_HOPS: '2' }), 2)
  })
})

describe('clientIp', () => {
  it('ignores proxy headers when hops unset (never trusts first XFF)', () => {
    const h = new Headers({
      'x-forwarded-for': '9.9.9.9, 10.0.0.1',
      'x-real-ip': '10.0.0.1',
    })
    assert.equal(clientIp(h, {}), 'unknown')
  })

  it('prefers x-real-ip when hops ≥ 1', () => {
    const h = new Headers({
      'x-forwarded-for': '9.9.9.9, 10.0.0.1',
      'x-real-ip': '10.0.0.1',
    })
    assert.equal(clientIp(h, { STARFORGE_TRUSTED_PROXY_HOPS: '1' }), '10.0.0.1')
  })

  it('uses XFF at length−hops when x-real-ip is absent', () => {
    const h = new Headers({
      'x-forwarded-for': 'evil.spoof, 203.0.113.10, 10.0.0.1',
    })
    // hops=1 → rightmost (appended by closest proxy) = 10.0.0.1
    assert.equal(clientIp(h, { STARFORGE_TRUSTED_PROXY_HOPS: '1' }), '10.0.0.1')
    // hops=2 → second from right = real client behind two proxies
    assert.equal(clientIp(h, { STARFORGE_TRUSTED_PROXY_HOPS: '2' }), '203.0.113.10')
  })

  it('does not return the leftmost spoofed XFF hop with hops=1', () => {
    const h = new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' })
    assert.notEqual(clientIp(h, { STARFORGE_TRUSTED_PROXY_HOPS: '1' }), '1.2.3.4')
    assert.equal(clientIp(h, { STARFORGE_TRUSTED_PROXY_HOPS: '1' }), '5.6.7.8')
  })
})
