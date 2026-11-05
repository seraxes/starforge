import 'server-only'

import type { DashboardStatsResult } from '@/core/dashboard'

import { formatFormsLatestGlance } from './forms-glance'

export { formatFormsLatestGlance } from './forms-glance'

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

/** Rolling windows for “new” submission counts. */
export const FORMS_NEW_24H_MS = 24 * 60 * 60_000
export const FORMS_NEW_7D_MS = 7 * 24 * 60 * 60_000

/**
 * Real `sf_form_submissions` aggregates for `forms.submissions`.
 * Soft-fails when the DB is unreachable — host already soft-renders broken widgets.
 */
export async function loadFormsSubmissionsStats(): Promise<
  DashboardStatsResult<FormsSubmissionsStats>
> {
  try {
    // Dynamic import keeps pure helpers / unit tests free of the pg pool.
    const { count, desc, sql } = await import('drizzle-orm')
    const { db, sfFormSubmissions } = await import('@/core/db')

    const since24h = new Date(Date.now() - FORMS_NEW_24H_MS)
    const since7d = new Date(Date.now() - FORMS_NEW_7D_MS)

    const [totals] = await db
      .select({
        total: count(),
        new24h: sql<number>`count(*) filter (where ${sfFormSubmissions.createdAt} >= ${since24h})::int`,
        new7d: sql<number>`count(*) filter (where ${sfFormSubmissions.createdAt} >= ${since7d})::int`,
      })
      .from(sfFormSubmissions)

    const [latest] = await db
      .select({
        createdAt: sfFormSubmissions.createdAt,
        formKey: sfFormSubmissions.formKey,
      })
      .from(sfFormSubmissions)
      .orderBy(desc(sfFormSubmissions.createdAt))
      .limit(1)

    return {
      ok: true,
      data: {
        byKey: {
          total: Number(totals?.total ?? 0),
          new24h: Number(totals?.new24h ?? 0),
          new7d: Number(totals?.new7d ?? 0),
          latest: formatFormsLatestGlance(latest?.createdAt, latest?.formKey),
        },
      },
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Forms submissions dashboard query failed'
    console.error('[dashboard] forms.submissions stats failed', error)
    return {
      ok: false,
      error: message,
      status: 'error',
    }
  }
}
