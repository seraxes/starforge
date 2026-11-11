'use client'

import React, { useState } from 'react'

import { authClient } from '@/core/auth/client'

/**
 * Continues with Google via Better Auth `signIn.social`.
 * Render only when the server passed `googleSignInEnabled` (both env keys set).
 * Does not read `GOOGLE_CLIENT_SECRET`.
 */
export function GoogleSignInButton({
  callbackURL = '/',
}: {
  /** Safe same-origin path after Google returns (resolved post-login URL). */
  callbackURL?: string
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function continueWithGoogle() {
    setPending(true)
    setError(null)
    try {
      const result = await authClient.signIn.social({
        provider: 'google',
        callbackURL,
        errorCallbackURL: `/login?error=google&next=${encodeURIComponent(callbackURL)}`,
      })
      if (result.error) {
        setError(result.error.message || 'Google sign-in failed.')
        setPending(false)
      }
      // On success Better Auth redirects to Google — leave pending true.
    } catch {
      setError('Google sign-in failed. Try again or use email.')
      setPending(false)
    }
  }

  return (
    <div className="auth-google">
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="gantry-btn"
        disabled={pending}
        onClick={() => void continueWithGoogle()}
      >
        {pending ? 'Redirecting…' : 'Continue with Google'}
      </button>
    </div>
  )
}
