/**
 * Mutable Better Auth email-verification gate, synced from Site Chrome
 * (same shared-by-ref pattern as siteChromeCookieAttributes).
 * Default stays off so local sign-in is unchanged until an admin enables it.
 *
 * Pass this object into betterAuth as `emailAndPassword` (do not spread it) so
 * Chrome saves keep flipping `requireEmailVerification` without a restart.
 */

export const emailAndPasswordOptions: {
  enabled: true
  minPasswordLength: number
  /** Keep true; Better Auth skips auto sign-in when requireEmailVerification is on. */
  autoSignIn: true
  requireEmailVerification: boolean
  revokeSessionsOnPasswordReset: true
} = {
  enabled: true,
  minPasswordLength: 8,
  autoSignIn: true,
  requireEmailVerification: false,
  revokeSessionsOnPasswordReset: true,
}

export function applyAuthEmailVerificationPolicy(require: boolean): void {
  emailAndPasswordOptions.requireEmailVerification = Boolean(require)
}

export function isAuthEmailVerificationRequired(): boolean {
  return emailAndPasswordOptions.requireEmailVerification
}

/** Load Site Chrome and sync the live Better Auth flag (cold workers / API routes). */
export async function syncAuthEmailVerificationPolicy(): Promise<boolean> {
  try {
    const { getSiteChrome } = await import('@/core/site-chrome')
    const chrome = await getSiteChrome()
    applyAuthEmailVerificationPolicy(chrome.authRequireEmailVerification)
  } catch {
    // Chrome table may be missing before db:core:push — keep default off.
  }
  return emailAndPasswordOptions.requireEmailVerification
}
