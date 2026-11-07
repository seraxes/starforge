import React from 'react'
import { getLocale } from 'next-intl/server'

import { getAccessViewer } from '@/core/acl/access'
import { canSeeNavAccessTags } from '@/core/acl/nav-access'
import { isAppLocale } from '@/core/i18n/locales'
import { withLocalePrefix } from '@/core/i18n/path'
import type { StarforgeModule } from '@/core/modules/types'
import { MODULE_IDS, isCatalogModuleEnabled } from '@/core/settings'

import { listEventPartiesByIds } from '../parties'
import {
  EventDetail,
  relatedEventLinksFromRecords,
} from '../public/EventDetail'
import { eventPublicPathKey } from '../public/path'
import {
  findEventById,
  findPublishedEventByPublicKey,
  findVenueById,
} from '../store'
import { readEventDetailConfig } from './event-detail-config'

/**
 * event-detail particle — one published event by id/slug (slot config).
 * Gated by product:events.
 */
export const eventDetailModule: StarforgeModule = {
  id: 'event-detail',
  name: 'Event detail',
  description: 'Single published event from product:events (pick id or slug).',
  defaultWidth: 100,
  navViews: [{ key: 'events', label: 'Events', href: '/events' }],
  render: async ({ slot, settings }) => {
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.events)) {
      return null
    }

    const cfg = readEventDetailConfig(slot.config)
    if (!cfg.eventKey) {
      return React.createElement(
        'p',
        { className: 'sf-event-detail-empty' },
        'Select an event id or slug in the particle settings.',
      )
    }

    const event = await findPublishedEventByPublicKey(cfg.eventKey)
    if (!event) {
      return React.createElement(
        'p',
        { className: 'sf-event-detail-empty' },
        'Event not found.',
      )
    }

    const viewer = await getAccessViewer()
    if (!canSeeNavAccessTags(event.accessTags, viewer)) {
      return null
    }

    const venue = event.venueId ? await findVenueById(event.venueId) : null
    const [organizers, speakers, sponsors, relatedRows] = await Promise.all([
      listEventPartiesByIds(event.organizerPartyIds),
      listEventPartiesByIds(event.speakerPartyIds),
      listEventPartiesByIds(event.sponsorPartyIds),
      Promise.all(event.relatedEventIds.map((rid) => findEventById(rid))),
    ])
    const localeRaw = await getLocale()
    const locale = isAppLocale(localeRaw) ? localeRaw : undefined
    const relatedById = new Map(
      relatedRows
        .filter((r): r is NonNullable<typeof r> => Boolean(r) && r.status === 'published')
        .filter((r) => canSeeNavAccessTags(r.accessTags, viewer))
        .map((r) => [r.id, r]),
    )
    const relatedEvents = relatedEventLinksFromRecords(
      event.relatedEventIds,
      relatedById,
      (rel) =>
        withLocalePrefix(
          `/events/${encodeURIComponent(eventPublicPathKey(rel))}`,
          locale,
        ),
    )

    return React.createElement(EventDetail, {
      event,
      venueName: venue?.name,
      venueAddress: venue?.address,
      organizers,
      speakers,
      sponsors,
      relatedEvents,
      listHref: cfg.showBackLink
        ? withLocalePrefix('/events', locale)
        : undefined,
    })
  },
}
