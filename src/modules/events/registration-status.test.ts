import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  publicSignupAck,
  registrationHoldsSeat,
  registrationSeatFreed,
  resolveInitialRegistrationStatus,
  resolveStatusAfterPayment,
} from './registration-status'

describe('events registration approval', () => {
  it('waitlists a full event before approval', () => {
    assert.equal(
      resolveInitialRegistrationStatus({
        needsWaitlist: true,
        requireApproval: true,
      }),
      'waitlisted',
    )
    assert.equal(
      resolveInitialRegistrationStatus({
        needsWaitlist: true,
        requireApproval: false,
      }),
      'waitlisted',
    )
  })

  it('holds a free seat as pending only when approval is required', () => {
    assert.equal(
      resolveInitialRegistrationStatus({
        needsWaitlist: false,
        requireApproval: true,
      }),
      'pending',
    )
    assert.equal(
      resolveInitialRegistrationStatus({
        needsWaitlist: false,
        requireApproval: false,
      }),
      'registered',
    )
  })

  it('waits for approval after payment when the gate is on', () => {
    assert.equal(resolveStatusAfterPayment(true), 'pending')
    assert.equal(resolveStatusAfterPayment(false), 'registered')
  })

  it('counts pending and pending_payment as seats, not the waitlist', () => {
    assert.equal(registrationHoldsSeat('pending'), true)
    assert.equal(registrationHoldsSeat('pending_payment'), true)
    assert.equal(registrationHoldsSeat('registered'), true)
    assert.equal(registrationHoldsSeat('waitlisted'), false)
    assert.equal(registrationHoldsSeat('cancelled'), false)
  })

  it('frees a seat when a pending signup is cancelled, not when it is approved', () => {
    assert.equal(
      registrationSeatFreed({
        previousStatus: 'pending',
        nextStatus: 'cancelled',
        previousGuests: 2,
        nextGuests: 2,
      }),
      true,
    )
    assert.equal(
      registrationSeatFreed({
        previousStatus: 'pending',
        nextStatus: 'registered',
        previousGuests: 2,
        nextGuests: 2,
      }),
      false,
    )
    assert.equal(
      registrationSeatFreed({
        previousStatus: 'waitlisted',
        nextStatus: 'cancelled',
        previousGuests: 1,
        nextGuests: 1,
      }),
      false,
    )
  })

  it('acks pending and waitlist without claiming a confirmed seat', () => {
    assert.equal(publicSignupAck('pending'), 'Your signup is awaiting approval.')
    assert.equal(publicSignupAck('waitlisted'), 'You are on the waitlist.')
    assert.equal(publicSignupAck('registered'), undefined)
  })
})
