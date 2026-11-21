import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { canInteract, type CanInteractContext } from './interact'
import { createPollsCheckinMemory } from './polls-checkin'

function interactOk(overrides: Partial<CanInteractContext> = {}): CanInteractContext {
  return {
    isBlocked: false,
    actorHidden: false,
    otherHidden: false,
    actorBannedAt: null,
    otherBannedAt: null,
    ...overrides,
  }
}

function mem() {
  return createPollsCheckinMemory({
    now: () => new Date('2026-11-20T21:00:00.000Z'),
    newId: (() => {
      let n = 0
      return () => `id-${++n}`
    })(),
  })
}

describe('polls and check-in', () => {
  it('creates and edits an open poll, votes uniquely, and saves a check-in pin (success path)', () => {
    const polls = mem()

    const created = polls.createPoll({
      authorUserId: 'alice',
      body: 'Lunch?',
      options: ['Pizza', 'Sushi'],
      audience: 'public',
    })
    assert.equal(created.ok, true)
    if (!created.ok) return
    assert.equal(created.post.kind, 'poll')
    assert.equal(created.post.pollOptions.length, 2)
    assert.equal(created.post.pollClosedAt, null)

    const edited = polls.editPoll({
      actorUserId: 'alice',
      postId: created.post.id,
      body: 'Lunch today?',
      options: [
        { id: created.post.pollOptions[0]!.id, label: 'Pizza' },
        { id: created.post.pollOptions[1]!.id, label: 'Tacos' },
        { label: 'Salad' },
      ],
    })
    assert.equal(edited.ok, true)
    if (!edited.ok) return
    assert.equal(edited.post.body, 'Lunch today?')
    assert.equal(edited.post.pollOptions.length, 3)
    assert.equal(edited.post.pollOptions[1]!.label, 'Tacos')

    const vote = polls.vote({
      userId: 'bob',
      postId: edited.post.id,
      optionId: edited.post.pollOptions[0]!.id,
      canView: true,
      interact: interactOk(),
    })
    assert.equal(vote.ok, true)
    if (!vote.ok) return
    assert.equal(vote.write, 'insert')

    // Unique (postId, userId): second vote updates the open row.
    const again = polls.vote({
      userId: 'bob',
      postId: edited.post.id,
      optionId: edited.post.pollOptions[1]!.id,
      canView: true,
      interact: interactOk(),
    })
    assert.equal(again.ok, true)
    if (!again.ok) return
    assert.equal(again.write, 'update')
    assert.equal(again.vote.id, vote.vote.id)
    assert.equal(again.vote.optionId, edited.post.pollOptions[1]!.id)

    const checkin = polls.createCheckin({
      authorUserId: 'alice',
      placeLabel: 'Central Park',
      body: 'Here',
      audience: 'friends',
      resolveMapsPin: (label) => ({
        pinId: `pin-${label}`,
        lat: 40.7829,
        lng: -73.9654,
      }),
    })
    assert.equal(checkin.ok, true)
    if (!checkin.ok) return
    assert.equal(checkin.post.kind, 'checkin')
    assert.equal(checkin.post.placeLabel, 'Central Park')
    assert.equal(checkin.post.mapsPinId, 'pin-Central Park')
    assert.equal(checkin.post.placeLat, 40.7829)
    assert.equal(checkin.post.placeLng, -73.9654)
  })

  it('refuses editing a closed poll, and still saves the check-in label when Maps fails (failure path)', () => {
    const polls = mem()

    const created = polls.createPoll({
      authorUserId: 'alice',
      options: ['Yes', 'No'],
      audience: 'public',
    })
    assert.equal(created.ok, true)
    if (!created.ok) return

    const closed = polls.closePoll({
      actorUserId: 'alice',
      postId: created.post.id,
    })
    assert.equal(closed.ok, true)
    if (!closed.ok) return
    assert.ok(closed.post.pollClosedAt)

    const refused = polls.editPoll({
      actorUserId: 'alice',
      postId: created.post.id,
      body: 'changed',
      options: ['Maybe', 'Never'],
    })
    assert.deepEqual(refused, { ok: false, reason: 'closed' })
    assert.equal(polls.getPost(created.post.id)?.body, created.post.body)

    const mapsFailed = polls.createCheckin({
      authorUserId: 'alice',
      placeLabel: 'Field Alpha',
      audience: 'public',
      resolveMapsPin: () => {
        throw new Error('maps door failed')
      },
    })
    assert.equal(mapsFailed.ok, true)
    if (!mapsFailed.ok) return
    assert.equal(mapsFailed.post.placeLabel, 'Field Alpha')
    assert.equal(mapsFailed.post.mapsPinId, null)
    assert.equal(mapsFailed.post.placeLat, null)
    assert.equal(mapsFailed.post.placeLng, null)

    // Blocked viewer cannot vote (relationship write).
    const blocked = interactOk({ isBlocked: true })
    assert.equal(canInteract('bob', 'alice', blocked), false)
    const voteRefused = polls.vote({
      userId: 'bob',
      postId: created.post.id,
      optionId: created.post.pollOptions[0]!.id,
      canView: true,
      interact: blocked,
    })
    // Poll is closed, so closed wins — still a refuse; reopen path for block:
    const open = polls.createPoll({
      authorUserId: 'alice',
      options: ['A', 'B'],
      audience: 'public',
    })
    assert.equal(open.ok, true)
    if (!open.ok) return
    const blockedVote = polls.vote({
      userId: 'bob',
      postId: open.post.id,
      optionId: open.post.pollOptions[0]!.id,
      canView: true,
      interact: blocked,
    })
    assert.deepEqual(blockedVote, { ok: false, reason: 'blocked' })
    assert.equal(voteRefused.ok, false)
  })
})
