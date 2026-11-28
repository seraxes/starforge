import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  claimRegistrationSeatInBag,
  EVENT_FULL_WAITLIST_CLOSED,
  evaluateRegistrationCapacity,
  type RegistrationSeatBag,
} from './registration-status'

/** Serialize async claims so count+insert stay atomic (DB transaction stand-in). */
function createSeatClaimQueue() {
  let chain: Promise<unknown> = Promise.resolve()
  return function enqueue<T>(fn: () => T | Promise<T>): Promise<T> {
    const next = chain.then(() => fn())
    chain = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }
}

describe('evaluateRegistrationCapacity', () => {
  it('marks the last open seat as free and the next guest as waitlist', () => {
    assert.deepEqual(
      evaluateRegistrationCapacity({
        occupiedEvent: 0,
        eventCapacity: 1,
        occupiedTier: 0,
        tierCapacity: null,
        guests: 1,
        waitlistEnabled: true,
      }),
      { needsWaitlist: false },
    )
    assert.deepEqual(
      evaluateRegistrationCapacity({
        occupiedEvent: 1,
        eventCapacity: 1,
        occupiedTier: 0,
        tierCapacity: null,
        guests: 1,
        waitlistEnabled: true,
      }),
      { needsWaitlist: true },
    )
  })

  it('refuses when full and waitlist is closed', () => {
    assert.deepEqual(
      evaluateRegistrationCapacity({
        occupiedEvent: 1,
        eventCapacity: 1,
        occupiedTier: 0,
        tierCapacity: null,
        guests: 1,
        waitlistEnabled: false,
      }),
      { error: EVENT_FULL_WAITLIST_CLOSED },
    )
  })
})

describe('last-seat registration race', () => {
  it('two overlapping claims for the last seat leave one registered; loser is waitlisted', async () => {
    const bag: RegistrationSeatBag = { rows: [] }
    const enqueue = createSeatClaimQueue()
    const base = {
      eventId: 'evt_1',
      eventCapacity: 1 as number | null,
      waitlistEnabled: true,
      requireApproval: false,
    }

    const [first, second] = await Promise.all([
      enqueue(() =>
        claimRegistrationSeatInBag(bag, {
          ...base,
          id: 'reg_a',
          guests: 1,
        }),
      ),
      enqueue(() =>
        claimRegistrationSeatInBag(bag, {
          ...base,
          id: 'reg_b',
          guests: 1,
        }),
      ),
    ])

    assert.ok(!('error' in first))
    assert.ok(!('error' in second))
    if ('error' in first || 'error' in second) return

    const statuses = [first.registration.status, second.registration.status].sort()
    assert.deepEqual(statuses, ['registered', 'waitlisted'])
    assert.equal(
      bag.rows.filter((r) => r.status === 'registered').length,
      1,
    )
    assert.equal(
      bag.rows.filter((r) => r.status === 'waitlisted').length,
      1,
    )
  })

  it('two overlapping claims refuse the loser when waitlist is closed', async () => {
    const bag: RegistrationSeatBag = { rows: [] }
    const enqueue = createSeatClaimQueue()
    const base = {
      eventId: 'evt_1',
      eventCapacity: 1 as number | null,
      waitlistEnabled: false,
      requireApproval: false,
    }

    const [first, second] = await Promise.all([
      enqueue(() =>
        claimRegistrationSeatInBag(bag, {
          ...base,
          id: 'reg_a',
          guests: 1,
        }),
      ),
      enqueue(() =>
        claimRegistrationSeatInBag(bag, {
          ...base,
          id: 'reg_b',
          guests: 1,
        }),
      ),
    ])

    const winner = 'error' in first ? second : first
    const loser = 'error' in first ? first : second
    assert.ok(!('error' in winner))
    if ('error' in winner) return
    assert.equal(winner.registration.status, 'registered')
    assert.ok('error' in loser)
    assert.equal(loser.error, EVENT_FULL_WAITLIST_CLOSED)
    assert.equal(bag.rows.length, 1)
    assert.equal(bag.rows[0]?.status, 'registered')
  })

  it('tier capacity also admits only one registered winner', async () => {
    const bag: RegistrationSeatBag = { rows: [] }
    const enqueue = createSeatClaimQueue()
    const base = {
      eventId: 'evt_1',
      ticketTierId: 'tier_1',
      eventCapacity: null as number | null,
      tierCapacity: 1,
      waitlistEnabled: true,
      requireApproval: false,
    }

    const [first, second] = await Promise.all([
      enqueue(() =>
        claimRegistrationSeatInBag(bag, { ...base, id: 'reg_a', guests: 1 }),
      ),
      enqueue(() =>
        claimRegistrationSeatInBag(bag, { ...base, id: 'reg_b', guests: 1 }),
      ),
    ])

    assert.ok(!('error' in first))
    assert.ok(!('error' in second))
    if ('error' in first || 'error' in second) return
    const statuses = [first.registration.status, second.registration.status].sort()
    assert.deepEqual(statuses, ['registered', 'waitlisted'])
  })
})
