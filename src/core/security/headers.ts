import { shouldUseSecureCookies } from './secure-cookies'

export type SecurityHeader = { key: string; value: string }

/**
 * Practical baseline for Next 16 + Payload 3 + Turnstile — not a WAF.
 * Allows inline/eval scripts Payload/Next still need; frames Turnstile only.
 * HSTS is included only when the app is on the Secure-cookie / HTTPS path.
 */
export function buildSecurityHeaders(options?: {
  /** Override HSTS inclusion (defaults to same signal as Secure cookies). */
  hsts?: boolean
}): SecurityHeader[] {
  const hsts = options?.hsts ?? shouldUseSecureCookies()

  const headers: SecurityHeader[] = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // Camera allowed for Media mobile upload; mic/geo off until a module needs them.
    {
      key: 'Permissions-Policy',
      value: 'camera=(self), microphone=(), geolocation=(), payment=()',
    },
    {
      key: 'Content-Security-Policy',
      value: [
        "default-src 'self'",
        // Next + Payload admin still rely on inline / eval in places.
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        "connect-src 'self' https://challenges.cloudflare.com",
        "frame-src 'self' https://challenges.cloudflare.com",
        "media-src 'self' blob:",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'self'",
      ].join('; '),
    },
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
  options?: { hsts?: boolean },
): void {
  for (const { key, value } of buildSecurityHeaders(options)) {
    headers.set(key, value)
  }
}
