import React from 'react'
import Link from 'next/link'

import { AuthOptionsLinks } from '@/components/AuthOptionsLinks'
import { SignOutButton } from '@/components/SignOutButton'
import {
  LoginForm,
  type LoginMode,
} from '@/app/(frontend)/(public)/login/login-form'
import { resolveCaptchaForSurface } from '@/core/security/captcha'

export type AuthWelcomePanelProps = {
  siteName: string
  /** Heading override (default Welcome / Welcome back). */
  title?: string
  /** Short welcome copy — keep hero/CMS branding free of auth clutter. */
  welcomeNote?: string
  registrationEnabled?: boolean
  signedIn?: boolean
  userEmail?: string | null
  userName?: string | null
  /** Embed on home / layout particle (not full-viewport auth-page). */
  variant?: 'page' | 'embed'
  /** Deep-link tab for LoginForm (`password` | `magic` | `otp`). */
  initialMode?: LoginMode
  next?: string
  resetSuccess?: boolean
  magicError?: boolean
  /** When false, show option links + Sign in CTA only (no full form). */
  showForm?: boolean
}

const DEFAULT_GUEST_NOTE =
  'Sign in with the email you registered. Password, magic link, or email code — one login for the app and CMS when you have access.'

const DEFAULT_SIGNED_IN_NOTE =
  'You are signed in. Enable authenticator 2FA and keep recovery codes under Account security.'

/**
 * Welcome note + login panel matching public `/login` / `/register` look.
 * Prefer this beside (or below) branded CMS content — do not park it in the hero.
 */
export async function AuthWelcomePanel({
  siteName,
  title,
  welcomeNote,
  registrationEnabled = true,
  signedIn = false,
  userEmail,
  userName,
  variant = 'embed',
  initialMode,
  next,
  resetSuccess,
  magicError,
  showForm = true,
}: AuthWelcomePanelProps) {
  const note =
    welcomeNote?.trim() || (signedIn ? DEFAULT_SIGNED_IN_NOTE : DEFAULT_GUEST_NOTE)
  const cardClass =
    variant === 'page' ? 'auth-card' : 'auth-card auth-welcome-embed'
  const TitleTag = variant === 'page' ? 'h1' : 'h2'
  const heading = title?.trim() || (signedIn ? 'Welcome back' : 'Welcome')

  if (signedIn) {
    return (
      <aside className={cardClass} aria-label="Account welcome">
        <p className="brand">{siteName}</p>
        <TitleTag className={variant === 'embed' ? 'auth-welcome-title' : undefined}>
          {heading}
        </TitleTag>
        <p className="lede">{note}</p>
        <p className="auth-hint">
          Signed in as <strong>{userEmail ?? 'member'}</strong>
          {userName ? <> ({userName})</> : null}.
        </p>
        <p className="auth-welcome-actions">
          <Link href="/account/security" className="button-link auth-welcome-primary">
            Account security / 2FA
          </Link>
        </p>
        <AuthOptionsLinks signedIn variant="panel" />
        <p className="auth-switch auth-switch-row">
          <Link href="/">Home</Link>
          <SignOutButton />
        </p>
      </aside>
    )
  }

  const captcha =
    showForm ? await resolveCaptchaForSurface('auth-recovery') : null

  return (
    <aside className={cardClass} aria-label="Welcome sign-in">
      <p className="brand">{siteName}</p>
      <TitleTag className={variant === 'embed' ? 'auth-welcome-title' : undefined}>
        {heading}
      </TitleTag>
      <p className="lede">{note}</p>
      {showForm && captcha ? (
        <LoginForm
          next={next}
          resetSuccess={resetSuccess}
          magicError={magicError}
          initialMode={initialMode}
          showHelperLinks={false}
          captcha={captcha}
        />
      ) : (
        <p className="auth-welcome-actions">
          <Link href="/login" className="button-link auth-welcome-primary">
            Sign in
          </Link>
          {registrationEnabled ? <Link href="/register">Create account</Link> : null}
        </p>
      )}
      <AuthOptionsLinks variant="panel" />
      <p className="auth-switch">
        {registrationEnabled ? (
          <>
            No account yet? <Link href="/register">Create an app account</Link>
          </>
        ) : (
          <>Registration is currently off.</>
        )}
        {variant === 'embed' ? (
          <>
            {' · '}
            <Link href="/login">Full sign-in page</Link>
          </>
        ) : null}
      </p>
    </aside>
  )
}
