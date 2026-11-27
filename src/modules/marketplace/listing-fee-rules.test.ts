import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  decideListingFeeHookAction,
  decideListingPublishWithFee,
} from './listing-fee-rules'

describe('marketplace listing fee publish', () => {
  it('fee off skips the cart and publishes active', () => {
    const decision = decideListingPublishWithFee(
      { listingFeeEnabled: false, listingFeeMinor: 999 },
      true,
    )
    assert.equal(decision.needsCart, false)
    assert.equal(decision.status, 'active')
    assert.equal(decision.feeMinor, 0)
  })

  it('fee on refuses to mark the listing active before the hook', () => {
    const decision = decideListingPublishWithFee(
      { listingFeeEnabled: true, listingFeeMinor: 1500 },
      true,
    )
    assert.equal(decision.needsCart, true)
    assert.equal(decision.status, 'draft')
    assert.equal(decision.feeMinor, 1500)

    // Hook is what flips draft → active; publish alone must not.
    const beforeHook = decideListingFeeHookAction('draft', 'paid')
    assert.equal(beforeHook.action, 'activate')
    assert.equal(beforeHook.action === 'activate' ? beforeHook.nextStatus : null, 'active')
  })
})

describe('marketplace listing fee hook', () => {
  it('a second paid event is a no-op', () => {
    const first = decideListingFeeHookAction('draft', 'paid')
    assert.equal(first.action, 'activate')

    const second = decideListingFeeHookAction('active', 'paid')
    assert.equal(second.action, 'noop')
  })

  it('refunded hides the listing', () => {
    const fromDraft = decideListingFeeHookAction('draft', 'refunded')
    assert.equal(fromDraft.action, 'hide')
    assert.equal(fromDraft.action === 'hide' ? fromDraft.nextStatus : null, 'hidden')

    const fromActive = decideListingFeeHookAction('active', 'refunded')
    assert.equal(fromActive.action, 'hide')
    assert.equal(fromActive.action === 'hide' ? fromActive.nextStatus : null, 'hidden')
  })

  it('expired and failed leave a draft listing draft', () => {
    assert.equal(decideListingFeeHookAction('draft', 'expired').action, 'leave_draft')
    assert.equal(decideListingFeeHookAction('draft', 'failed').action, 'leave_draft')
  })
})
