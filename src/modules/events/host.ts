/**
 * Hosted events — plain-text hostModule / hostKind / hostId on the Events row.
 *
 * Social groups and pages list and link create through `@/modules/events/api`
 * with hostModule = product:social. The event editor stays the Events screen.
 * Do not put a second calendar inside product:social.
 */

export const SOCIAL_EVENTS_HOST_MODULE = 'product:social' as const

export const EVENT_HOST_KINDS = ['group', 'page'] as const
export type EventHostKind = (typeof EVENT_HOST_KINDS)[number]

export type EventHostRef = {
  hostModule: string
  hostKind: EventHostKind
  hostId: string
}

export function isEventHostKind(value: unknown): value is EventHostKind {
  return value === 'group' || value === 'page'
}

/**
 * Parse optional host fields on an event.
 * All empty → standalone (null). Any host field set requires hostId (and the rest).
 */
export function parseEventHost(input: {
  hostModule?: unknown
  hostKind?: unknown
  hostId?: unknown
}): { ok: true; host: EventHostRef | null } | { ok: false; error: string } {
  const hostModule = String(input.hostModule ?? '').trim()
  const hostKindRaw = String(input.hostKind ?? '').trim()
  const hostId = String(input.hostId ?? '').trim()

  if (!hostModule && !hostKindRaw && !hostId) {
    return { ok: true, host: null }
  }

  if (!hostId) {
    return { ok: false, error: 'Host id is required.' }
  }
  if (!hostModule) {
    return { ok: false, error: 'Host module is required.' }
  }
  if (!isEventHostKind(hostKindRaw)) {
    return { ok: false, error: 'Host kind must be group or page.' }
  }

  return {
    ok: true,
    host: {
      hostModule: hostModule.slice(0, 120),
      hostKind: hostKindRaw,
      hostId: hostId.slice(0, 120),
    },
  }
}

/** Social group/page host — hostModule is always product:social. */
export function resolveSocialEventHost(input: {
  hostKind?: unknown
  hostId?: unknown
}): { ok: true; host: EventHostRef } | { ok: false; error: string } {
  const parsed = parseEventHost({
    hostModule: SOCIAL_EVENTS_HOST_MODULE,
    hostKind: input.hostKind,
    hostId: input.hostId,
  })
  if (!parsed.ok) return parsed
  if (!parsed.host) {
    return { ok: false, error: 'Host id is required.' }
  }
  return { ok: true, host: parsed.host }
}

/** Deep-link to Events admin create with host fields (editor stays Events). */
export function buildHostedEventCreateHref(host: EventHostRef): string {
  const q = new URLSearchParams({
    create: '1',
    hostModule: host.hostModule,
    hostKind: host.hostKind,
    hostId: host.hostId,
  })
  return `/admin/events?${q.toString()}`
}

/** Deep-link to the Events editor for an existing row. */
export function buildHostedEventEditHref(eventId: string): string {
  const id = eventId.trim()
  return id ? `/admin/events/${encodeURIComponent(id)}` : '/admin/events'
}
