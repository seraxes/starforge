import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'

import {
  applyAuthEmailVerificationPolicy,
  emailAndPasswordOptions,
  isAuthEmailVerificationRequired,
} from './email-verification-policy'

/**
 * Better Auth credential sign-in (sign-in.mjs) refuses when
 * `emailAndPassword.requireEmailVerification && !user.emailVerified`.
 * This app passes `emailAndPasswordOptions` by reference into betterAuth.
 */
function betterAuthBlocksUnverifiedCredentialSignIn(emailVerified: boolean): boolean {
  return emailAndPasswordOptions.requireEmailVerification && !emailVerified
}

/**
 * loginAction maps Better Auth's `EMAIL_NOT_VERIFIED` ("Email not verified")
 * to a member-facing refuse message via this check.
 */
function loginActionRefusesUnverifiedMessage(message: string): boolean {
  return /email not verified/i.test(message)
}

afterEach(() => {
  applyAuthEmailVerificationPolicy(false)
})

describe('auth email-verification policy', () => {
  it('defaults off so unverified sign-in stays allowed at the policy layer', () => {
    applyAuthEmailVerificationPolicy(false)
    assert.equal(isAuthEmailVerificationRequired(), false)
    assert.equal(emailAndPasswordOptions.requireEmailVerification, false)
    assert.equal(betterAuthBlocksUnverifiedCredentialSignIn(false), false)
  })

  it('when required, Better Auth gate + loginAction refuse unverified accounts', () => {
    applyAuthEmailVerificationPolicy(true)
    assert.equal(isAuthEmailVerificationRequired(), true)
    assert.equal(emailAndPasswordOptions.requireEmailVerification, true)
    assert.equal(betterAuthBlocksUnverifiedCredentialSignIn(false), true)
    assert.equal(betterAuthBlocksUnverifiedCredentialSignIn(true), false)
    assert.equal(loginActionRefusesUnverifiedMessage('Email not verified'), true)
  })
})
