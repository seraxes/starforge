/**
 * Pure formatters for the Performance glance card (Site Settings → Performance).
 * Secrets / backend enum stay in Environment — only non-secret knobs + cache mode.
 */

export function formatDashboardRefreshGlance(sec: number): string {
  return `${Math.round(sec)}s`
}

export function formatFormRateWindowGlance(sec: number): string {
  return `${Math.round(sec)}s`
}

export function formatFormRateMaxGlance(max: number): string {
  return String(Math.round(max))
}

/**
 * Content cache glance: Off (Performance toggle) · Redis · Next (default tag cache).
 * `STARFORGE_CONTENT_CACHE` is env-only — never invent a DB-backed backend label.
 */
export function formatContentCacheGlance(
  enabled: boolean,
  contentCacheEnv: string | undefined = process.env.STARFORGE_CONTENT_CACHE,
): string {
  if (!enabled) return 'Off'
  const backend = typeof contentCacheEnv === 'string' ? contentCacheEnv.trim().toLowerCase() : ''
  if (backend === 'redis') return 'Redis'
  return 'Next'
}
