import React from 'react'
import Link from 'next/link'

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
}: AuthOptionsLinksProps) {
  if (signedIn) {
    return (
      <nav
        className={['auth-options', `auth-options--${variant}`, className]
          .filter(Boolean)
          .join(' ')}
        aria-label="Account security"
      >
        {variant === 'panel' ? <p className="auth-options-label">Account</p> : null}
        <ul className="auth-options-list">
          <li>
            <Link href="/account/security">Set up or manage 2FA</Link>
            {variant === 'panel' ? (
              <span className="auth-options-hint">Authenticator + recovery codes</span>
            ) : null}
          </li>
          <li>
            <Link href="/forgot-password">Change password via email</Link>
          </li>
        </ul>
      </nav>
    )
  }

  return (
    <nav
      className={['auth-options', `auth-options--${variant}`, className].filter(Boolean).join(' ')}
      aria-label="Sign-in options"
    >
      {variant === 'panel' ? <p className="auth-options-label">Sign-in options</p> : null}
      <ul className="auth-options-list">
        <li>
          <Link href="/forgot-password">Forgot password?</Link>
        </li>
        <li>
          <Link href="/forgot-username">Forgot login email?</Link>
        </li>
        <li>
          <Link href="/login?mode=magic">Magic link</Link>
          {variant === 'panel' ? (
            <span className="auth-options-hint">Passwordless email link</span>
          ) : null}
        </li>
        <li>
          <Link href="/login?mode=otp">Email code</Link>
          {variant === 'panel' ? (
            <span className="auth-options-hint">One-time OTP</span>
          ) : null}
        </li>
        <li>
          <Link href="/login?mode=password">Stay signed in</Link>
          {variant === 'panel' ? (
            <span className="auth-options-hint">Checkbox on password / email code sign-in</span>
          ) : null}
        </li>
        <li>
          <Link href="/login?next=/account/security">2FA setup</Link>
          {variant === 'panel' ? (
            <span className="auth-options-hint">After sign-in → Account security</span>
          ) : null}
        </li>
      </ul>
    </nav>
  )
}
