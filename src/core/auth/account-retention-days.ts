/**
 * Account retention wait (days). Shared by Core settings and the retention clock.
 * Kept free of Better Auth / server-only imports so Site Settings defaults stay
 * safe for client bundles.
 */

/** Default wait before purge eligibility (one year). */
export const DEFAULT_ACCOUNT_RETENTION_DAYS = 365

/** Inclusive lower bound for the Core retention setting (days). */
export const ACCOUNT_RETENTION_DAYS_MIN = 1

/** Inclusive upper bound for the Core retention setting (days). */
export const ACCOUNT_RETENTION_DAYS_MAX = 3650

function coerceFiniteNumber(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) ? n : null
}

/** Clamp / coerce the Core account retention wait (days). */
export function clampAccountRetentionDays(raw: unknown): number {
  const n = coerceFiniteNumber(raw)
  if (n == null) return DEFAULT_ACCOUNT_RETENTION_DAYS
  return Math.min(
    ACCOUNT_RETENTION_DAYS_MAX,
    Math.max(ACCOUNT_RETENTION_DAYS_MIN, Math.round(n)),
  )
}
