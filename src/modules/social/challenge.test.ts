import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  challengePhaseDeadline,
  computeAcceptDeadline,
  computeChallengeEndsAt,
  computeUploadDeadline,
  createChallengeMemory,
  decideChallengeMultiInvite,
  isChallengeShareForbidden,
  isValidChallengeTiming,
  type ChallengeMultiGate,
} from './challenge'
import { canInteract, type CanInteractContext } from './interact'

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

function multiGate(overrides: Partial<ChallengeMultiGate> = {}): ChallengeMultiGate {
  return {
    subscriptionsEnabled: false,
    hasMultiEntitlement: false,
    ...overrides,
  }
}

describe('challenge timing', () => {
  it('creates a challenge when length covers the accept window (success path)', () => {
    const publishedAt = new Date('2026-11-20T12:00:00.000Z')
    const mem = createChallengeMemory({
      now: () => publishedAt,
      newId: (() => {
        let n = 0
        return () => `id-${++n}`
      })(),
    })

    const created = mem.create({
      creatorUserId: 'alice',
      body: 'Open challenge',
      lengthDays: 2,
      acceptWindowHours: 48,
      publishedAt,
      mediaId: 'media-open',
    })
    assert.equal(created.ok, true)
    if (!created.ok) return

    assert.equal(created.challenge.lengthDays, 2)
    assert.equal(created.challenge.acceptWindowHours, 48)
    assert.deepEqual(
      created.challenge.endsAt,
      computeChallengeEndsAt(publishedAt, 2),
    )
    assert.equal(created.post.kind, 'challenge')
    assert.equal(created.creatorEntry.isCreator, true)
    assert.equal(created.creatorEntry.status, 'submitted')
    assert.equal(isChallengeShareForbidden(created.post.kind), true)

    const acceptDeadline = computeAcceptDeadline(publishedAt, 48, created.challenge.endsAt)
    assert.deepEqual(
      acceptDeadline,
      challengePhaseDeadline(
        new Date(publishedAt.getTime() + 48 * 60 * 60 * 1000),
        created.challenge.endsAt,
      ),
    )
    const lateAccept = new Date(created.challenge.endsAt.getTime() - 60 * 60 * 1000)
    const uploadDeadline = computeUploadDeadline(lateAccept, 48, created.challenge.endsAt)
    assert.deepEqual(uploadDeadline, created.challenge.endsAt)

    const invite = mem.invite({
      challengeId: created.challenge.id,
      actorUserId: 'alice',
      inviteeUserId: 'bob',
      areFriends: true,
      interact: interactOk(),
      multi: multiGate(),
    })
    assert.equal(invite.ok, true)
    if (!invite.ok) return
    assert.equal(invite.entry.status, 'invited')
    assert.equal(mem.countInvites(created.challenge.id), 1)
  })

  it('refuses a 48-hour window with lengthDays 1 (failure path)', () => {
    assert.equal(
      isValidChallengeTiming({ acceptWindowHours: 48, lengthDays: 1 }),
      false,
    )
    const mem = createChallengeMemory()
    const refused = mem.create({
      creatorUserId: 'alice',
      lengthDays: 1,
      acceptWindowHours: 48,
    })
    assert.deepEqual(refused, { ok: false, reason: 'invalid_timing' })
    assert.equal(mem.bag.challenges.size, 0)
    assert.equal(mem.bag.posts.size, 0)
  })
})

describe('challenge invites and likes', () => {
  it('keeps the invite when mail emit fails (success path)', async () => {
    const mem = createChallengeMemory()
    const created = mem.create({
      creatorUserId: 'alice',
      lengthDays: 1,
      acceptWindowHours: 24,
    })
    assert.equal(created.ok, true)
    if (!created.ok) return

    let emitCalls = 0
    const result = await mem.inviteWithMail(
      {
        challengeId: created.challenge.id,
        actorUserId: 'alice',
        inviteeUserId: 'bob',
        areFriends: true,
        interact: interactOk(),
        multi: multiGate(),
      },
      async () => {
        emitCalls += 1
        throw new Error('smtp down')
      },
    )
    assert.equal(result.ok, true)
    assert.equal(emitCalls, 1)
    assert.equal(mem.countInvites(created.challenge.id), 1)
  })

  it('refuses a second invite when Subscriptions is off (no /plans link)', () => {
    const mem = createChallengeMemory()
    const created = mem.create({
      creatorUserId: 'alice',
      lengthDays: 3,
      acceptWindowHours: 24,
    })
    assert.equal(created.ok, true)
    if (!created.ok) return

    assert.equal(
      mem.invite({
        challengeId: created.challenge.id,
        actorUserId: 'alice',
        inviteeUserId: 'bob',
        areFriends: true,
        interact: interactOk(),
        multi: multiGate({ subscriptionsEnabled: false }),
      }).ok,
      true,
    )

    const second = mem.invite({
      challengeId: created.challenge.id,
      actorUserId: 'alice',
      inviteeUserId: 'carol',
      areFriends: true,
      interact: interactOk(),
      multi: multiGate({ subscriptionsEnabled: false }),
    })
    assert.deepEqual(second, {
      ok: false,
      reason: 'multi_required',
      plansHref: null,
    })
    assert.deepEqual(
      decideChallengeMultiInvite(1, {
        subscriptionsEnabled: true,
        hasMultiEntitlement: false,
      }),
      { ok: false, reason: 'multi_required', plansHref: '/plans' },
    )
  })

  it('refuses an invite when the pair is blocked (blocked-user case)', () => {
    const mem = createChallengeMemory()
    const created = mem.create({
      creatorUserId: 'alice',
      lengthDays: 1,
      acceptWindowHours: 24,
    })
    assert.equal(created.ok, true)
    if (!created.ok) return

    const blocked = interactOk({ isBlocked: true })
    assert.equal(canInteract('alice', 'bob', blocked), false)

    const invite = mem.invite({
      challengeId: created.challenge.id,
      actorUserId: 'alice',
      inviteeUserId: 'bob',
      areFriends: true,
      interact: blocked,
      multi: multiGate(),
    })
    assert.deepEqual(invite, { ok: false, reason: 'blocked' })
    assert.equal(mem.countInvites(created.challenge.id), 0)
  })

  it('refuses a like from an entrant and moves a spectator like', () => {
    const mem = createChallengeMemory({
      newId: (() => {
        let n = 0
        return () => `id-${++n}`
      })(),
    })
    const created = mem.create({
      creatorUserId: 'alice',
      lengthDays: 2,
      acceptWindowHours: 24,
      mediaId: 'm1',
    })
    assert.equal(created.ok, true)
    if (!created.ok) return

    const invite = mem.invite({
      challengeId: created.challenge.id,
      actorUserId: 'alice',
      inviteeUserId: 'bob',
      areFriends: true,
      interact: interactOk(),
      multi: multiGate(),
    })
    assert.equal(invite.ok, true)
    if (!invite.ok) return

    // Mark bob submitted so there is a second entry to like.
    mem.bag.entries.set(invite.entry.id, {
      ...invite.entry,
      status: 'submitted',
      acceptedAt: new Date('2026-11-20T13:00:00.000Z'),
      submittedAt: new Date('2026-11-20T14:00:00.000Z'),
      mediaId: 'm2',
    })

    const entrantLike = mem.like({
      challengeId: created.challenge.id,
      actorUserId: 'bob',
      entryId: created.creatorEntry.id,
      interact: interactOk(),
    })
    assert.deepEqual(entrantLike, { ok: false, reason: 'entrant_cannot_like' })

    const first = mem.like({
      challengeId: created.challenge.id,
      actorUserId: 'spectator',
      entryId: created.creatorEntry.id,
      interact: interactOk(),
    })
    assert.equal(first.ok, true)
    if (!first.ok) return
    assert.equal(first.write, 'insert')

    const moved = mem.like({
      challengeId: created.challenge.id,
      actorUserId: 'spectator',
      entryId: invite.entry.id,
      interact: interactOk(),
    })
    assert.equal(moved.ok, true)
    if (!moved.ok) return
    assert.equal(moved.write, 'update')
    assert.equal(moved.like.id, first.like.id)
    assert.equal(moved.like.entryId, invite.entry.id)
    assert.equal(mem.bag.likes.size, 1)
  })
})
