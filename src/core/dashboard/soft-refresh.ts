import { clampDashboardRefreshIntervalSec } from '@/core/settings/defaults'

/** Convert a (possibly unclamped) settings seconds value to a poll interval in ms. */
export function dashboardRefreshIntervalMs(rawSec: unknown): number {
  return clampDashboardRefreshIntervalSec(rawSec) * 1000
}

/**
 * When the tab becomes visible again, refresh immediately if the soft-refresh
 * interval has already elapsed while the tab was hidden.
 */
export function shouldRefreshOnBecomeVisible(
  elapsedMs: number,
  intervalMs: number,
): boolean {
  if (intervalMs <= 0) return false
  return elapsedMs >= intervalMs
}

/** Format a Date as the Dashboard “Last refreshed” UTC label (no redesign). */
export function formatDashboardRefreshedAt(date: Date): string {
  return `${date.toISOString().replace('T', ' ').slice(0, 19)} UTC`
}
