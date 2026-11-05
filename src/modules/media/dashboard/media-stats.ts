import 'server-only'

import type { DashboardStatsResult } from '@/core/dashboard'

/** Media kind buckets Dashboard mirrors from the library taxonomy. */
export const MEDIA_DASHBOARD_KINDS = [
  { key: 'images', label: 'Images' },
  { key: 'audio', label: 'Audio' },
  { key: 'video', label: 'Video' },
  { key: 'docs', label: 'Docs' },
  { key: 'other', label: 'Other' },
] as const

export type MediaKindKey = (typeof MEDIA_DASHBOARD_KINDS)[number]['key']

export type MediaCountsStats = {
  byKind: Record<MediaKindKey, number | null>
  new24h: number | null
  new1w: number | null
  new1m: number | null
}

/**
 * Soft placeholder loader — D2 will replace with Payload Media aggregates.
 * Returns unavailable so the card shows “—” / Coming soon, not fake zeros.
 */
export async function loadMediaCountsStats(): Promise<
  DashboardStatsResult<MediaCountsStats>
> {
  return {
    ok: false,
    error: 'Media dashboard counts are not wired yet',
    status: 'unavailable',
  }
}
