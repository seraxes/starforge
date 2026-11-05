import 'server-only'

import type { DashboardStatsResult } from '@/core/dashboard'

import {
  formatContentCacheGlance,
  formatDashboardRefreshGlance,
  formatFormRateMaxGlance,
  formatFormRateWindowGlance,
} from './performance-glance'

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

export {
  formatContentCacheGlance,
  formatDashboardRefreshGlance,
  formatFormRateMaxGlance,
  formatFormRateWindowGlance,
} from './performance-glance'

/**
 * Real Performance glance for `performance.glance`.
 * Mirrors non-secret Site Settings → Performance knobs + env cache backend label.
 * Soft-fails if settings cannot load.
 */
export async function loadPerformanceGlanceStats(): Promise<
  DashboardStatsResult<PerformanceGlanceStats>
> {
  try {
    const { getSiteSettings } = await import('@/core/settings')
    const settings = await getSiteSettings()

    return {
      ok: true,
      data: {
        byKey: {
          dashboardRefresh: formatDashboardRefreshGlance(settings.dashboardRefreshIntervalSec),
          formRateWindow: formatFormRateWindowGlance(settings.formRateLimitWindowSec),
          formRateMax: formatFormRateMaxGlance(settings.formRateLimitMax),
          contentCache: formatContentCacheGlance(settings.publishedCacheEnabled),
        },
      },
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Performance glance failed'
    console.error('[dashboard] performance.glance stats failed', error)
    return {
      ok: false,
      error: message,
      status: 'error',
    }
  }
}
