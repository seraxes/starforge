import { urlOrigin } from './csp'

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1']

/**
 * Browser origins the app is served from: `NEXT_PUBLIC_APP_URL`,
 * `BETTER_AUTH_URL`, and comma-separated `STARFORGE_TRUSTED_ORIGINS`.
 * A loopback URL also trusts its localhost / 127.0.0.1 twin
 * (`allowedDevOrigins` lets local testing use either).
 */
export function appTrustedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const origins = new Set<string>()
  const candidates = [
    env.NEXT_PUBLIC_APP_URL,
    env.BETTER_AUTH_URL,
    ...(env.STARFORGE_TRUSTED_ORIGINS ?? '').split(','),
  ]
  for (const raw of candidates) {
    const origin = urlOrigin(raw)
    if (origin) origins.add(origin)
  }
  if (!origins.size) origins.add('http://localhost:3000')

  for (const origin of [...origins]) {
    const url = new URL(origin)
    if (!LOOPBACK_HOSTS.includes(url.hostname)) continue
    for (const host of LOOPBACK_HOSTS) {
      url.hostname = host
      origins.add(url.origin)
    }
  }
  return [...origins]
}

/** Request names an Origin that is not one of ours (cross-origin cookie use). */
export function hasUntrustedOrigin(
  headers: Headers,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const origin = headers.get('origin')
  if (!origin) return false
  return !appTrustedOrigins(env).includes(origin)
}

/**
 * Payload `csrf` allowlist: the `payload-token` cookie is only accepted from
 * these Origins (cross-site requests without Origin fall back to
 * `Sec-Fetch-Site`). An empty list would accept the cookie from anywhere.
 */
export function payloadCsrfOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  return appTrustedOrigins(env)
}
