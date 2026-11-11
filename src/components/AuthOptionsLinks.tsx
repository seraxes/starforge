import React from 'react'
import Link from 'next/link'

export type AuthPublicOptions = {
  forgotPassword?: boolean
  forgotUsername?: boolean
  magicLink?: boolean
  emailOtp?: boolean
  rememberMe?: boolean
  twoFactor?: boolean
  /** When true, password sign-in waits for the verification email link. */
  requireEmailVerification?: boolean
}

export type AuthOptionsLinksProps = {
  /** When true, emphasize Account security (2FA) as the primary CTA. */
  signedIn?: boolean
  /** Optional class on the nav wrapper. */
  className?: string
  /**
   * `strip` = compact inline helpers (login card footer).
   * `panel` = labeled list for welcome/home showcase.
   */
  variant?: 'strip' | 'panel'
  /** Site Settings → Auth option gates (default all on). */
  options?: AuthPublicOptions
}

/**
 * Clear public CTAs for Better Auth recovery / passwordless / 2FA surfaces from #64.
 * Guest: forgot password/username, magic link, email OTP, stay signed in (via login).
 * Signed in: Account security for authenticator 2FA.
 */
export function AuthOptionsLinks({
  signedIn = false,
  className,
  variant = 'strip',
  options,
}: AuthOptionsLinksProps) {
  const forgotPassword = options?.forgotPassword !== false
  const forgotUsername = options?.forgotUsername !== false
  const magicLink = options?.magicLink !== false
  const emailOtp = options?.emailOtp !== false
  const rememberMe = options?.rememberMe !== false
  const twoFactor = options?.twoFactor !== false

  if (signedIn) {
    const signedInItems: React.ReactNode[] = []
    if (twoFactor) {
      signedInItems.push(
        <li key="2fa">
          <Link href="/account/security">Set up or manage 2FA</Link>
          {variant === 'panel' ? (
            <span className="auth-options-hint">Authenticator + recovery codes</span>
          ) : null}
        </li>,
      )
    }
    if (forgotPassword) {
      signedInItems.push(
        <li key="forgot-pw">
          <Link href="/forgot-password">Change password via email</Link>
        </li>,
      )
    }
    if (signedInItems.length === 0) return null

    return (
      <nav
        className={['auth-options', `auth-options--${variant}`, className]
          .filter(Boolean)
          .join(' ')}
        aria-label="Account security"
      >
        {variant === 'panel' ? <p className="auth-options-label">Account</p> : null}
        <ul className="auth-options-list">{signedInItems}</ul>
      </nav>
    )
  }

  const guestItems: React.ReactNode[] = []
  if (forgotPassword) {
    guestItems.push(
      <li key="forgot-pw">
        <Link href="/forgot-password">Forgot password?</Link>
      </li>,
    )
  }
  if (forgotUsername) {
    guestItems.push(
      <li key="forgot-user">
        <Link href="/forgot-username">Forgot login email?</Link>
      </li>,
    )
  }
  if (magicLink) {
    guestItems.push(
      <li key="magic">
        <Link href="/login?mode=magic">Magic link</Link>
        {variant === 'panel' ? (
          <span className="auth-options-hint">Passwordless email link</span>
        ) : null}
      </li>,
    )
  }
  if (emailOtp) {
    guestItems.push(
      <li key="otp">
        <Link href="/login?mode=otp">Email code</Link>
        {variant === 'panel' ? (
          <span className="auth-options-hint">One-time OTP</span>
        ) : null}
      </li>,
    )
  }
  if (rememberMe) {
    guestItems.push(
      <li key="remember">
        <Link href="/login?mode=password">Stay signed in</Link>
        {variant === 'panel' ? (
          <span className="auth-options-hint">Checkbox on password / email code sign-in</span>
        ) : null}
      </li>,
    )
  }
  if (twoFactor) {
    guestItems.push(
      <li key="2fa">
        <Link href="/login?next=/account/security">2FA setup</Link>
        {variant === 'panel' ? (
          <span className="auth-options-hint">After sign-in → Account security</span>
        ) : null}
      </li>,
    )
  }

  if (guestItems.length === 0) return null

  return (
    <nav
      className={['auth-options', `auth-options--${variant}`, className].filter(Boolean).join(' ')}
      aria-label="Sign-in options"
    >
      {variant === 'panel' ? <p className="auth-options-label">Sign-in options</p> : null}
      <ul className="auth-options-list">{guestItems}</ul>
    </nav>
  )
}
