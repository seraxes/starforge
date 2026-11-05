import 'server-only'

import type { DashboardStatsResult } from '@/core/dashboard'

/** Soft Events “upcoming” glance rows. */
export const EVENTS_DASHBOARD_ROWS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'thisWeek', label: 'This week' },
  { key: 'registrations', label: 'Registrations' },
] as const

export type EventsUpcomingKey = (typeof EVENTS_DASHBOARD_ROWS)[number]['key']

export type EventsUpcomingStats = {
  byKey: Record<EventsUpcomingKey, number | null>
}

/**
 * Real `sf_events` aggregates for `events.upcoming`.
 * Upcoming / this week = published with starts_at ≥ now (week = next 7 days).
 * Registrations stay 0 until PR3 wires Forms registration.
 * Soft-fails when the DB / table is unreachable.
 */
export async function loadEventsUpcomingStats(): Promise<
  DashboardStatsResult<EventsUpcomingStats>
> {
  try {
    const { countUpcomingEvents } = await import('../store')
    const { upcoming, thisWeek } = await countUpcomingEvents()
    return {
      ok: true,
      data: {
        byKey: {
          upcoming,
          thisWeek,
          registrations: 0,
        },
      },
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Events dashboard query failed'
    console.error('[dashboard] events.upcoming stats failed', error)
    return {
      ok: false,
      error: message,
      status: 'error',
    }
  }
}
