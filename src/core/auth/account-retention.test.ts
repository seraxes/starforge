import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  DEFAULT_ACCOUNT_RETENTION_DAYS,
  computePurgeEligibleAt,
  createAccountRetentionMemory,
  isAccountPubliclyAbsent,
  isStaffAccount,
} from './account-retention'

describe('Core account retention clock', () => {
  it('hide keeps rows', () => {
    const now = () => new Date('2026-11-21T12:00:00.000Z')
    const mem = createAccountRetentionMemory({
      account: { userId: 'alice', role: 'member' },
      now,
    })
    mem.seedRelated('profile:alice', { handle: 'alice' })
    mem.seedRelated('social:post-1', { authorUserId: 'alice' })
    mem.seedRelated('session:s1', { userId: 'alice' })

    const before = mem.relatedCount()
    assert.equal(before, 3)

    const result = mem.hide({ userId: 'alice', isAppAdmin: false })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.purged, false)
    assert.equal(result.account.hiddenAt?.toISOString(), now().toISOString())
    assert.equal(
      result.account.purgeEligibleAt?.toISOString(),
      computePurgeEligibleAt(now(), DEFAULT_ACCOUNT_RETENTION_DAYS).toISOString(),
    )
    assert.equal(mem.relatedCount(), before)
    assert.ok(mem.bag.relatedRows.has('profile:alice'))
    assert.ok(mem.bag.relatedRows.has('social:post-1'))
    assert.equal(mem.bag.finallyDeleted, false)
    assert.equal(isAccountPubliclyAbsent(result.account), true)
  })

  it('restore clears the clock', () => {
    const now = () => new Date('2026-11-21T12:00:00.000Z')
    const mem = createAccountRetentionMemory({
      account: { userId: 'alice', role: 'member' },
      now,
    })
    mem.seedRelated('profile:alice', { handle: 'alice' })

    const hidden = mem.hide({ userId: 'alice', isAppAdmin: false })
    assert.equal(hidden.ok, true)
    if (!hidden.ok) return
    assert.ok(hidden.account.hiddenAt)
    assert.ok(hidden.account.purgeEligibleAt)

    const restored = mem.restore({ userId: 'alice', isAppAdmin: false })
    assert.equal(restored.ok, true)
    if (!restored.ok) return
    assert.equal(restored.account.hiddenAt, null)
    assert.equal(restored.account.purgeEligibleAt, null)
    assert.equal(isAccountPubliclyAbsent(restored.account), false)
    // Rows still present after restore.
    assert.equal(mem.relatedCount(), 1)

    // Staff with restore grant can clear another member’s clock.
    const again = mem.hide({ userId: 'alice', isAppAdmin: false })
    assert.equal(again.ok, true)
    const staffRestore = mem.restore({
      userId: 'admin-1',
      isAppAdmin: true,
      canRestore: true,
    })
    assert.equal(staffRestore.ok, true)
    if (!staffRestore.ok) return
    assert.equal(staffRestore.account.hiddenAt, null)
    assert.equal(staffRestore.account.purgeEligibleAt, null)
  })

  it('final delete before the date is refused', () => {
    const hideAt = new Date('2026-11-21T12:00:00.000Z')
    const tooEarly = new Date('2026-12-21T12:00:00.000Z')
    const mem = createAccountRetentionMemory({
      account: { userId: 'alice', role: 'member' },
      now: () => tooEarly,
      retentionDays: DEFAULT_ACCOUNT_RETENTION_DAYS,
    })
    mem.seedRelated('profile:alice', { handle: 'alice' })

    const hide = mem.hide({ userId: 'alice', isAppAdmin: false })
    assert.equal(hide.ok, true)
    if (!hide.ok) return
    // Force the clock from hideAt (memory hide used tooEarly as now).
    mem.bag.account.hiddenAt = hideAt
    mem.bag.account.purgeEligibleAt = computePurgeEligibleAt(
      hideAt,
      DEFAULT_ACCOUNT_RETENTION_DAYS,
    )

    const refused = mem.finalDelete({ userId: 'admin-1', isAppAdmin: true })
    assert.deepEqual(refused, { ok: false, reason: 'too_early' })
    assert.equal(mem.relatedCount(), 1)
    assert.equal(mem.bag.finallyDeleted, false)

    // Legal hold also blocks after the date.
    const afterWait = new Date(
      mem.bag.account.purgeEligibleAt!.getTime() + 24 * 60 * 60 * 1000,
    )
    const late = createAccountRetentionMemory({
      account: {
        userId: 'alice',
        role: 'member',
        hiddenAt: hideAt,
        purgeEligibleAt: mem.bag.account.purgeEligibleAt,
        legalHold: true,
      },
      now: () => afterWait,
    })
    late.seedRelated('keep', 1)
    const holdRefuse = late.finalDelete({ userId: 'admin-1', isAppAdmin: true })
    assert.deepEqual(holdRefuse, { ok: false, reason: 'legal_hold' })
    assert.equal(late.relatedCount(), 1)
  })

  it('a staff account is refused', () => {
    assert.equal(isStaffAccount('admin'), true)
    assert.equal(isStaffAccount('member'), false)

    const now = () => new Date('2026-11-21T12:00:00.000Z')
    const staff = createAccountRetentionMemory({
      account: { userId: 'admin-self', role: 'admin' },
      now,
    })
    staff.seedRelated('admin-row', { id: 'admin-self' })

    // Member flow / self cannot hide a staff account.
    const selfHide = staff.hide({ userId: 'admin-self', isAppAdmin: true })
    assert.deepEqual(selfHide, { ok: false, reason: 'staff_account' })
    assert.equal(staff.bag.account.hiddenAt, null)
    assert.equal(staff.relatedCount(), 1)

    // Non-admin actor cannot hide a staff account.
    const memberActor = staff.hide({ userId: 'mod-1', isAppAdmin: false })
    assert.deepEqual(memberActor, { ok: false, reason: 'staff_account' })

    // A different app admin may hide (SU/DEV stand-in until five roles exist).
    const otherAdmin = staff.hide({ userId: 'admin-other', isAppAdmin: true })
    assert.equal(otherAdmin.ok, true)
    if (!otherAdmin.ok) return
    assert.ok(otherAdmin.account.hiddenAt)
    assert.equal(staff.relatedCount(), 1)

    // Final delete of staff by self is refused.
    staff.bag.account.purgeEligibleAt = new Date('2025-01-01T00:00:00.000Z')
    const selfFinal = staff.finalDelete({
      userId: 'admin-self',
      isAppAdmin: true,
    })
    assert.deepEqual(selfFinal, { ok: false, reason: 'staff_account' })
    assert.equal(staff.bag.finallyDeleted, false)
  })
})
