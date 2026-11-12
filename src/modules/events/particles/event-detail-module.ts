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
  countRegisteredGuests,
  findActiveRegistrationForUserOnEvent,
  isEventSelfCancelOpen,
} from '../registrations'
import { resolveEventMediaSrc } from '../public/media-src'
import { loadEventsModuleSettings } from '../settings'
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
    const [
      organizers,
      speakers,
      sponsors,
      relatedRows,
      ticketTiers,
      occupied,
      myReg,
      coverSrc,
      moduleSettings,
    ] = await Promise.all([
      listEventPartiesByIds(event.organizerPartyIds),
      listEventPartiesByIds(event.speakerPartyIds),
      listEventPartiesByIds(event.sponsorPartyIds),
      Promise.all(event.relatedEventIds.map((rid) => findEventById(rid))),
      listPublicTicketTiersForEvent(event.id),
      countRegisteredGuests(event.id),
      viewer.userId
        ? findActiveRegistrationForUserOnEvent(viewer.userId, event.id)
        : Promise.resolve(null),
      resolveEventMediaSrc(event.coverMediaId),
      loadEventsModuleSettings(),
    ])
    const localeRaw = await getLocale()
    const locale = isAppLocale(localeRaw) ? localeRaw : undefined
    const eventPath = withLocalePrefix(
      `/events/${encodeURIComponent(eventPublicPathKey(event))}`,
      locale,
    )
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
    const signupStatus =
      myReg?.status === 'waitlisted'
        ? 'waitlisted'
        : myReg?.status === 'registered'
          ? 'registered'
          : 'none'
    const manageHref = myReg ? `${eventPath}/registration` : ''

    return React.createElement(EventDetail, {
      event,
      venueName: venue?.name,
      venueAddress: venue?.address,
      location: {
        name: venue?.name,
        address: venue?.address,
        latitude: venue?.latitude ?? null,
        longitude: venue?.longitude ?? null,
      },
      organizers,
      speakers,
      sponsors,
      relatedEvents,
      ticketTiers,
      occupied,
      signupStatus,
      coverSrc,
      tierCapacityDisplay: moduleSettings.settings.tierCapacityDisplay,
      eventPath,
      loginPath: withLocalePrefix('/login', locale),
      listHref: cfg.showBackLink
        ? withLocalePrefix('/events', locale)
        : undefined,
      activeTierId: myReg?.ticketTierId || '',
      selfCancelOpen: isEventSelfCancelOpen(event).open,
      canSwitchTier: Boolean(myReg && !myReg.paymentOrderId.trim()),
      manageHref,
      registrationId: myReg?.id || '',
    })
  },
}
