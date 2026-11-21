import Link from 'next/link'
import React from 'react'

import { withLocalePrefix } from '@/core/i18n/path'

type EventHostKind = 'group' | 'page'

type EventHostRef = {
  hostModule: string
  hostKind: EventHostKind
  hostId: string
}

type EventRecord = {
  id: string
  title: string
  slug: string
  status: string
  startsAt: Date | null
}

type EventsHostDoor = {
  resolveSocialEventHost: (input: {
    hostKind?: unknown
    hostId?: unknown
  }) => { ok: true; host: EventHostRef } | { ok: false; error: string }
  listEventsForHost: (host: EventHostRef) => Promise<EventRecord[]>
  buildHostedEventCreateHref: (host: EventHostRef) => string
  buildHostedEventEditHref: (eventId: string) => string
}

async function loadEventsHostDoor(): Promise<EventsHostDoor | null> {
  // Advanced must not import advanced — load Events through the Core door slot
  // (events-api → @/modules/events/api). Null when Events is off / not registered.
  try {
    const { loadModuleDoor } = await import('@/generated/module-registry.server')
    const door = await loadModuleDoor('events-api')
    if (!door) return null
    return door as unknown as EventsHostDoor
  } catch {
    return null
  }
}

function formatWhen(event: EventRecord): string {
  if (!event.startsAt) return 'No start time'
  try {
    return event.startsAt.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
  } catch {
    return 'No start time'
  }
}

function publicEventHref(event: EventRecord, locale: string): string {
  const key = (event.slug || event.id).trim()
  return withLocalePrefix(`/events/${encodeURIComponent(key)}`, locale)
}

/**
 * Social calendar tab body — lists and links create through product:events
 * (`loadModuleDoor('events-api')` → `@/modules/events/api`).
 * Not a second calendar pack; editor stays on the Events screen.
 */
export async function HostedEventsPanel({
  locale,
  hostKind,
  hostId,
  canManage,
}: {
  locale: string
  hostKind: EventHostKind
  hostId: string
  canManage: boolean
}) {
  const door = await loadEventsHostDoor()
  if (!door) {
    return (
      <section className="sf-social-hosted-events" aria-label="Calendar">
        <p className="layout-muted">Events is off — calendar unavailable.</p>
      </section>
    )
  }

  const hostResult = door.resolveSocialEventHost({ hostKind, hostId })
  if (!hostResult.ok) {
    return (
      <section className="sf-social-hosted-events" aria-label="Calendar">
        <p className="layout-muted" role="alert">
          {hostResult.error}
        </p>
      </section>
    )
  }

  const events = await door.listEventsForHost(hostResult.host)
  const createHref = door.buildHostedEventCreateHref(hostResult.host)

  return (
    <section className="sf-social-hosted-events" aria-label="Calendar">
      <div className="admin-control-row">
        <h2 className="sf-social-section-heading">Calendar</h2>
        {canManage ? (
          <Link className="gantry-btn gantry-btn-primary" href={createHref}>
            Create event
          </Link>
        ) : null}
      </div>
      {canManage ? (
        <p className="settings-hint">
          Opens the Events editor with this {hostKind} as host. Edit stays under Events.
        </p>
      ) : null}
      {events.length === 0 ? (
        <p className="layout-muted">No events yet.</p>
      ) : (
        <ul className="sf-social-hosted-events-list">
          {events.map((event) => (
            <li key={event.id} className="admin-control-row">
              <Link href={publicEventHref(event, locale)}>{event.title}</Link>
              <span className="layout-muted">{formatWhen(event)}</span>
              <span className="layout-muted">{event.status}</span>
              {canManage ? (
                <Link
                  className="gantry-btn"
                  href={door.buildHostedEventEditHref(event.id)}
                >
                  Edit
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
