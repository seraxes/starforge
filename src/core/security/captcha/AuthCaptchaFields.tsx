'use client'

import React from 'react'

import type { ResolvedCaptcha } from './types'
import { TurnstileWidget } from './TurnstileWidget'

type Props = {
  captcha: ResolvedCaptcha
}

/**
 * Shared auth/form captcha slot — Turnstile when required + configured.
 * Misconfigured required captcha shows an error (fail closed; do not skip).
 */
export function AuthCaptchaFields({ captcha }: Props) {
  if (!captcha.required) return null

  if (captcha.provider === 'turnstile' && captcha.siteKey) {
    return <TurnstileWidget siteKey={captcha.siteKey} />
  }

  if (captcha.misconfiguredReason) {
    return (
      <p className="auth-error" role="alert">
        {captcha.misconfiguredReason}
      </p>
    )
  }

  return (
    <p className="auth-error" role="alert">
      Captcha is required but not available. Please contact the site administrator.
    </p>
  )
}
