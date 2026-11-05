import 'server-only'

import type { DashboardStatsResult } from '@/core/dashboard'

/** Soft Forms submissions glance rows. */
export const FORMS_DASHBOARD_ROWS = [
  { key: 'total', label: 'Submissions (all)' },
  { key: 'new24h', label: 'New (24h)' },
  { key: 'new7d', label: 'New (7d)' },
  { key: 'latest', label: 'Latest' },
] as const

export type FormsSubmissionsKey = (typeof FORMS_DASHBOARD_ROWS)[number]['key']

export type FormsSubmissionsStats = {
  byKey: Record<FormsSubmissionsKey, string | number | null>
}

/**
 * Soft stub — later: count from `sf_form_submissions` + recent windows.
 * Unavailable → “—” / Coming soon, not fake zeros.
 */
export async function loadFormsSubmissionsStats(): Promise<
  DashboardStatsResult<FormsSubmissionsStats>
> {
  return {
    ok: false,
    error: 'Forms submissions dashboard counts are not wired yet',
    status: 'unavailable',
  }
}
