import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'

import {
  buildDoorCheckInPath,
  signRegistrationTicketToken,
  verifyRegistrationTicketToken,
} from './check-in-ticket'

describe('check-in-ticket', () => {
  const prev = process.env.BETTER_AUTH_SECRET

  afterEach(() => {
    if (prev === undefined) delete process.env.BETTER_AUTH_SECRET
    else process.env.BETTER_AUTH_SECRET = prev
  })

  it('builds admin check-in deep link', () => {
    assert.equal(
      buildDoorCheckInPath('evt_1', 'reg_2'),
      '/admin/events/check-in?eventId=evt_1&registrationId=reg_2',
    )
  })

  it('signs and verifies ticket tokens', () => {
    process.env.BETTER_AUTH_SECRET = 'test-secret-for-events-ticket-hmac'
    const token = signRegistrationTicketToken('reg_abc')
    assert.ok(token)
    assert.equal(verifyRegistrationTicketToken('reg_abc', token), true)
    assert.equal(verifyRegistrationTicketToken('reg_other', token), false)
    assert.equal(verifyRegistrationTicketToken('reg_abc', 'tampered'), false)
  })
})
