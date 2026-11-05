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
 * Soft stub — Events pack has no schema yet.
 * Unavailable → “—” / Coming soon (upcoming framing), not fake zeros.
 */
export async function loadEventsUpcomingStats(): Promise<
  DashboardStatsResult<EventsUpcomingStats>
> {
  return {
    ok: false,
    error: 'Events module is not shipped yet',
    status: 'unavailable',
  }
}
