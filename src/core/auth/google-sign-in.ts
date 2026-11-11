import 'server-only'

/**
 * Google OAuth for Better Auth — optional.
 * Both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` must be set; one alone stays off.
 * Never pass the secret into client components — only the boolean flag.
 */
export function readGoogleOAuthCredentials(): {
  clientId: string
  clientSecret: string
} | null {
  const clientId = (process.env.GOOGLE_CLIENT_ID ?? '').trim()
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET ?? '').trim()
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

/** Server-only: true when Google sign-in may be offered on `/login`. */
export function isGoogleSignInConfigured(): boolean {
  return readGoogleOAuthCredentials() !== null
}
