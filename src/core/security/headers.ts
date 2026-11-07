import { buildCspHeaders, type CspMode, type CspSources } from './csp'
import { shouldUseSecureCookies } from './secure-cookies'

export type SecurityHeader = { key: string; value: string }

/**
 * Practical baseline for Next 16 + Payload 3 — not a WAF.
 * CSP is composed from source groups (see `./csp`); feature sources
 * (Turnstile, Font Awesome, analytics, Page Settings assets) come from the
 * caller. HSTS is included only on the Secure-cookie / HTTPS path.
 */
export function buildSecurityHeaders(options?: {
  /** Override HSTS inclusion (defaults to same signal as Secure cookies). */
  hsts?: boolean
  /** Feature-driven CSP sources (Node proxy supplies them; static config omits). */
  cspSources?: CspSources | null
  /** Override `STARFORGE_CSP_MODE`. */
  cspMode?: CspMode
}): SecurityHeader[] {
  const hsts = options?.hsts ?? shouldUseSecureCookies()

  const headers: SecurityHeader[] = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // Camera: Media mobile upload. Geolocation: live tactical map (product:maps) Join session.
    {
      key: 'Permissions-Policy',
      value: 'camera=(self), microphone=(), geolocation=(self), payment=()',
    },
    ...buildCspHeaders({ features: options?.cspSources, mode: options?.cspMode }),
  ]

  if (hsts) {
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=31536000; includeSubDomains',
    })
  }

  return headers
}

/** Apply baseline security headers onto a NextResponse (or any Headers bag). */
export function applySecurityHeaders(
  headers: Headers,
  options?: Parameters<typeof buildSecurityHeaders>[0],
): void {
  for (const { key, value } of buildSecurityHeaders(options)) {
    headers.set(key, value)
  }
}
