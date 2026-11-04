/**
 * Key prefix so staging and prod can share one Redis safely.
 * Default: `sf:${NODE_ENV}` (e.g. `sf:production`). Override with STARFORGE_REDIS_PREFIX.
 */
export function redisKeyPrefix(): string {
  const raw = (process.env.STARFORGE_REDIS_PREFIX ?? '').trim()
  if (raw) return raw.replace(/:+$/, '')
  const env = (process.env.NODE_ENV ?? 'development').trim() || 'development'
  return `sf:${env}`
}
