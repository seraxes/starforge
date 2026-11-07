import React from 'react'
import { getLocale } from 'next-intl/server'

import { getAccessViewer } from '@/core/acl/access'
import { isAppLocale } from '@/core/i18n/locales'
import { withLocalePrefix } from '@/core/i18n/path'
import type { StarforgeModule } from '@/core/modules/types'
import { MODULE_IDS, isCatalogModuleEnabled } from '@/core/settings'

import { listEventPartiesByIds } from '../parties'
import {
  viewerPassesEventAcl,
  viewerPassesEventPassword,
} from '../public-access'
import { listPublicTicketTiersForEvent } from '../public-tiers'
import {
  EventDetail,
  relatedEventLinksFromRecords,
} from '../public/EventDetail'
import { EventPasswordGate } from '../public/EventPasswordGate'
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
    if (!viewerPassesEventAcl(event, viewer)) {
      return null
    }
    if (!(await viewerPassesEventPassword(event, viewer))) {
      return React.createElement(EventPasswordGate, {
        eventId: event.id,
        title: event.title,
      })
    }

    const venue = event.venueId ? await findVenueById(event.venueId) : null
    const [organizers, speakers, sponsors, relatedRows, ticketTiers] = await Promise.all([
      listEventPartiesByIds(event.organizerPartyIds),
      listEventPartiesByIds(event.speakerPartyIds),
      listEventPartiesByIds(event.sponsorPartyIds),
      Promise.all(event.relatedEventIds.map((rid) => findEventById(rid))),
      listPublicTicketTiersForEvent(event.id),
    ])
    const localeRaw = await getLocale()
    const locale = isAppLocale(localeRaw) ? localeRaw : undefined
    const relatedById = new Map(
      relatedRows
        .flatMap((r) =>
          r && r.status === 'published' && r.listed && viewerPassesEventAcl(r, viewer)
            ? [r]
            : [],
        )
        .map((r) => [r.id, r] as const),
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
      ticketTiers,
      listHref: cfg.showBackLink
        ? withLocalePrefix('/events', locale)
        : undefined,
    })
  },
}
