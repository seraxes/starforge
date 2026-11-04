/**
 * Resolve the client IP from request headers behind a trusted reverse proxy.
 *
 * When `STARFORGE_TRUSTED_PROXY_HOPS` is unset/0, proxy headers are ignored
 * (never trust the first X-Forwarded-For hop — clients can spoof it).
 *
 * When hops ≥ 1 (nginx / DO LB in front):
 * 1. Prefer `x-real-ip` (set by our nginx)
 * 2. Else take the IP at `length - hops` in X-Forwarded-For
 */
type EnvLike = Record<string, string | undefined>

export function trustedProxyHops(env: EnvLike = process.env): number {
  const raw = (env.STARFORGE_TRUSTED_PROXY_HOPS ?? '').trim()
  if (!raw || !/^\d+$/.test(raw)) return 0
  return Number.parseInt(raw, 10)
}

export function clientIp(headers: Headers, env: EnvLike = process.env): string {
  const hops = trustedProxyHops(env)
  if (hops < 1) return 'unknown'

  const realIp = headers.get('x-real-ip')?.trim()
  if (realIp) return realIp

  const forwarded = headers.get('x-forwarded-for')
  if (!forwarded) return 'unknown'

  const parts = forwarded
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length === 0) return 'unknown'

  const idx = Math.max(0, parts.length - hops)
  return parts[idx] ?? 'unknown'
}
