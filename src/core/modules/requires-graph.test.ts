import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  closeModuleRequires,
  resolveModuleToggleRequires,
  type RequiresNode,
} from './requires-graph'

const nodes: RequiresNode[] = [
  { id: 'product:media' },
  { id: 'product:forms', requires: ['product:media'] },
  { id: 'product:rich-editor', requires: ['product:media'] },
  { id: 'product:email-manager', requires: ['product:rich-editor', 'product:media'] },
  { id: 'product:payments', requires: ['product:email-manager'] },
  { id: 'product:profiles', requires: ['product:media', 'product:forms'] },
  { id: 'product:maps' },
  { id: 'product:events', requires: ['product:forms', 'product:media', 'product:payments', 'product:profiles', 'product:maps', 'product:rich-editor'] },
  { id: 'product:subscriptions', requires: ['product:payments', 'product:email-manager', 'product:forms', 'product:profiles'] },
]

describe('closeModuleRequires', () => {
  it('pulls the Events install set and skips Subscriptions', () => {
    const closed = closeModuleRequires(['product:events'], nodes)
    assert.deepEqual(closed.ids, [
      'product:email-manager',
      'product:events',
      'product:forms',
      'product:maps',
      'product:media',
      'product:payments',
      'product:profiles',
      'product:rich-editor',
    ])
    assert.equal(closed.ids.includes('product:subscriptions'), false)
    assert.ok(closed.pulled.includes('product:payments'))
  })

  it('rejects an unknown required id', () => {
    assert.throws(
      () => closeModuleRequires(['product:events'], [{ id: 'product:events', requires: ['product:missing'] }]),
      /unknown module product:missing/,
    )
  })
})

describe('resolveModuleToggleRequires', () => {
  it('turns dependencies on when the consumer is enabled', () => {
    const result = resolveModuleToggleRequires({
      previous: { 'product:events': false, 'product:forms': false, 'product:media': true },
      requested: { 'product:events': true, 'product:forms': false, 'product:media': true },
      nodes,
    })
    assert.ok(!('error' in result))
    if ('error' in result) return
    assert.equal(result.toggles['product:forms'], true)
    assert.equal(result.toggles['product:payments'], true)
  })

  it('refuses to turn off a dependency that a still-enabled pack needs', () => {
    const result = resolveModuleToggleRequires({
      previous: { 'product:events': true, 'product:media': true },
      requested: { 'product:events': true, 'product:media': false },
      nodes,
      labels: { 'product:media': 'Media library', 'product:events': 'Events' },
    })
    assert.ok('error' in result)
    if (!('error' in result)) return
    assert.match(result.error, /Media library is required by Events/)
  })

  it('allows turning a pack and its dependency off together', () => {
    const result = resolveModuleToggleRequires({
      previous: { 'product:events': true, 'product:maps': true },
      requested: { 'product:events': false, 'product:maps': false },
      nodes,
    })
    assert.ok(!('error' in result))
    if ('error' in result) return
    assert.equal(result.toggles['product:maps'], false)
  })
})
