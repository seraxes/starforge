import 'server-only'

import type { DashboardStatsResult } from '@/core/dashboard'

/** Soft Performance glance rows (Site Settings → Performance knobs). */
export const PERFORMANCE_DASHBOARD_ROWS = [
  { key: 'dashboardRefresh', label: 'Dashboard refresh' },
  { key: 'formRateWindow', label: 'Form rate window' },
  { key: 'formRateMax', label: 'Form rate max' },
  { key: 'contentCache', label: 'Content cache' },
] as const

export type PerformanceGlanceKey = (typeof PERFORMANCE_DASHBOARD_ROWS)[number]['key']

export type PerformanceGlanceStats = {
  byKey: Record<PerformanceGlanceKey, string | null>
}

/**
 * Soft stub — later: surface non-secret Performance settings (refresh interval,
 * form rate-limit window/max). Secrets/infra stay in Environment.
 */
export async function loadPerformanceGlanceStats(): Promise<
  DashboardStatsResult<PerformanceGlanceStats>
> {
  return {
    ok: false,
    error: 'Performance glance is not wired yet',
    status: 'unavailable',
  }
}
