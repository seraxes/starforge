import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { mergeMessageTrees, wrapModuleMessages } from './merge-messages'

describe('mergeMessageTrees', () => {
  it('merges core and module namespaces without clobbering siblings', () => {
    const merged = mergeMessageTrees(
      { Auth: { signIn: 'Sign in' }, Layout: { offlineAdminBanner: 'Offline' } },
      { 'product:consent': { acceptAll: 'Accept all' } },
      { 'product:forms': { sending: 'Sending…' } },
    )
    assert.equal((merged.Auth as { signIn: string }).signIn, 'Sign in')
    assert.equal(
      (merged['product:consent'] as { acceptAll: string }).acceptAll,
      'Accept all',
    )
    assert.equal((merged['product:forms'] as { sending: string }).sending, 'Sending…')
  })

  it('deep-merges overlapping objects; later wins on leaves', () => {
    const merged = mergeMessageTrees(
      { Auth: { signIn: 'Sign in', welcome: 'Welcome' } },
      { Auth: { signIn: 'Log in' } },
    )
    assert.deepEqual(merged.Auth, { signIn: 'Log in', welcome: 'Welcome' })
  })
})

describe('wrapModuleMessages', () => {
  it('nests a flat leaf under a single namespace', () => {
    assert.deepEqual(wrapModuleMessages(['product:consent'], { acceptAll: 'Accept all' }), {
      'product:consent': { acceptAll: 'Accept all' },
    })
  })

  it('passes through an already-namespaced leaf', () => {
    const leaf = { 'product:consent': { acceptAll: 'Accept all' } }
    assert.deepEqual(wrapModuleMessages(['product:consent'], leaf), leaf)
  })

  it('picks declared namespaces from a multi-namespace file', () => {
    const leaf = {
      'product:forms': { sending: 'Sending…' },
      other: { skip: true },
    }
    assert.deepEqual(wrapModuleMessages(['product:forms'], leaf), {
      'product:forms': { sending: 'Sending…' },
    })
  })
})
