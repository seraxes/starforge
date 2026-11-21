import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createFriendshipMemory } from './friends'

describe('friendships', () => {
  it('unfriends an accepted pair (success path)', () => {
    const graph = createFriendshipMemory()
    const requested = graph.request('alice', 'bob')
    assert.equal(requested.ok, true)
    const accepted = graph.accept('bob', 'alice')
    assert.equal(accepted.ok, true)
    assert.equal(graph.get('alice', 'bob')?.status, 'accepted')

    const result = graph.unfriend('alice', 'bob')
    assert.deepEqual(result, { ok: true, friendship: null })
    assert.equal(graph.get('alice', 'bob'), null)
  })

  it('refuses a second accept on an already accepted pair (failure path)', () => {
    const graph = createFriendshipMemory()
    assert.equal(graph.request('alice', 'bob').ok, true)
    assert.equal(graph.accept('bob', 'alice').ok, true)

    const second = graph.accept('bob', 'alice')
    assert.deepEqual(second, { ok: false, reason: 'already_accepted' })
    assert.equal(graph.get('alice', 'bob')?.status, 'accepted')
  })

  it('refuses a request after a block (failure path)', () => {
    const graph = createFriendshipMemory()
    assert.equal(graph.block('alice', 'bob').ok, true)
    assert.equal(graph.get('alice', 'bob')?.status, 'blocked')

    const result = graph.request('bob', 'alice')
    assert.deepEqual(result, { ok: false, reason: 'blocked' })
    assert.equal(graph.get('alice', 'bob')?.status, 'blocked')
    assert.equal(graph.get('alice', 'bob')?.blockedBy, 'alice')
    assert.equal(graph.get('alice', 'bob')?.blockedByOther, null)
  })
})
