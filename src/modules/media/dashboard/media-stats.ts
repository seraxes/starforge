import 'server-only'

import type { DashboardStatsResult } from '@/core/dashboard'

import {
  aggregateMediaKindCounts,
  emptyMediaKindCounts,
  type MediaKindKey,
} from './media-kind'

/** Media kind buckets Dashboard mirrors from the library mime taxonomy. */
export const MEDIA_DASHBOARD_KINDS = [
  { key: 'images', label: 'Images' },
  { key: 'audio', label: 'Audio' },
  { key: 'video', label: 'Video' },
  { key: 'docs', label: 'Docs' },
  { key: 'other', label: 'Other' },
] as const

export type { MediaKindKey }

/** Created-at windows for “new” upload counts (rolling, not calendar). */
export const MEDIA_NEW_24H_MS = 24 * 60 * 60_000
export const MEDIA_NEW_1W_MS = 7 * 24 * 60 * 60_000
export const MEDIA_NEW_1M_MS = 30 * 24 * 60 * 60_000

export type MediaCountsStats = {
  byKind: Record<MediaKindKey, number | null>
  new24h: number | null
  new1w: number | null
  new1m: number | null
}

export {
  aggregateMediaKindCounts,
  classifyMediaMimeKind,
  emptyMediaKindCounts,
  isMediaDocMime,
} from './media-kind'

/**
 * Real Payload Media aggregates for `media.counts`.
 * Soft-fails (ok:false) when the DB / `payload.media` is unreachable —
 * host already soft-renders broken widgets; this keeps the card intentional.
 */
export async function loadMediaCountsStats(): Promise<
  DashboardStatsResult<MediaCountsStats>
> {
  try {
    // Dynamic import keeps pure helpers / unit tests free of the pg pool.
    const { pool } = await import('@/core/db')

    const since24h = new Date(Date.now() - MEDIA_NEW_24H_MS)
    const since1w = new Date(Date.now() - MEDIA_NEW_1W_MS)
    const since1m = new Date(Date.now() - MEDIA_NEW_1M_MS)

    const kindResult = await pool.query<{ mime_type: string | null; n: number }>(
      `SELECT COALESCE(mime_type, '') AS mime_type, COUNT(*)::int AS n
       FROM payload.media
       GROUP BY 1`,
    )

    const windowResult = await pool.query<{
      new24h: number
      new1w: number
      new1m: number
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE created_at >= $1)::int AS new24h,
         COUNT(*) FILTER (WHERE created_at >= $2)::int AS new1w,
         COUNT(*) FILTER (WHERE created_at >= $3)::int AS new1m
       FROM payload.media`,
      [since24h, since1w, since1m],
    )

    const byKind = aggregateMediaKindCounts(
      kindResult.rows.map((row) => ({
        mimeType: row.mime_type,
        n: Number(row.n) || 0,
      })),
    )

    // Ensure every key is present even when GROUP BY returns no rows.
    const filled = { ...emptyMediaKindCounts(), ...byKind }
    const windows = windowResult.rows[0]

    return {
      ok: true,
      data: {
        byKind: filled,
        new24h: Number(windows?.new24h ?? 0),
        new1w: Number(windows?.new1w ?? 0),
        new1m: Number(windows?.new1m ?? 0),
      },
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Media dashboard counts query failed'
    console.error('[dashboard] media.counts stats failed', error)
    return {
      ok: false,
      error: message,
      status: 'error',
    }
  }
}
