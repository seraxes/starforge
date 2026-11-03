/**
 * When session cookies must carry the Secure attribute (and Better Auth’s
 * `__Secure-` name prefix via `useSecureCookies`).
 *
 * Resolution order:
 * 1. `STARFORGE_SECURE_COOKIES=1|true` / `0|false` — explicit override
 * 2. `https://` on `BETTER_AUTH_URL` or `NEXT_PUBLIC_APP_URL` → secure
 * 3. `http://` on those URLs → insecure (keeps local / LAN HTTP working)
 * 4. Fallback: `NODE_ENV === 'production'`
 *
 * Local `next dev` / `http://localhost` stays insecure. Production HTTPS
 * (DigitalOcean, etc.) flips on automatically from the public URL.
 */

function envFlag(raw: string | undefined): boolean | null {
  if (raw == null) return null
  const v = raw.trim().toLowerCase()
  if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true
  if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false
  return null
}

function appBaseUrl(): string {
  return (
    process.env.BETTER_AUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    ''
  )
}

/** True when Set-Cookie should use Secure (Better Auth, Payload JWT, gate cookies). */
export function shouldUseSecureCookies(): boolean {
  const override = envFlag(process.env.STARFORGE_SECURE_COOKIES)
  if (override !== null) return override

  const url = appBaseUrl()
  if (url.startsWith('https://')) return true
  if (url.startsWith('http://')) return false

  return process.env.NODE_ENV === 'production'
}
