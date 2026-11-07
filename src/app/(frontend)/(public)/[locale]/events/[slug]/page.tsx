import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import React from 'react'

import { getAccessViewer } from '@/core/acl/access'
import { requireContentLocale } from '@/core/content/pages'
import { isValidLocaleCode } from '@/core/i18n'
import { withLocalePrefix } from '@/core/i18n/path'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'
import { ensureEventsFormHooks } from '@/modules/events/form-hooks'
import { listEventPartiesByIds } from '@/modules/events/parties'
import {
  viewerPassesEventAcl,
  viewerPassesEventPassword,
} from '@/modules/events/public-access'
import {
  EventDetail,
  relatedEventLinksFromRecords,
} from '@/modules/events/public/EventDetail'
import { EventPasswordGate } from '@/modules/events/public/EventPasswordGate'
import { eventPublicPathKey } from '@/modules/events/public/path'
import { EventRegistrationForm } from '@/modules/events/public/EventRegistrationForm'
import { EventVenueMap } from '@/modules/events/public/EventVenueMap'
import { listPublicTicketTiersForEvent } from '@/modules/events/public-tiers'
import {
  findEventById,
  findPublishedEventByPublicKey,
  findVenueById,
} from '@/modules/events/store'

type Args = {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { locale: localeParam, slug } = await params
  const [settings, chrome] = await Promise.all([getSiteSettings(), getSiteChrome()])
  const siteName = chrome.siteName || settings.siteName

  if (!isValidLocaleCode(localeParam)) {
    return { title: `Not found — ${siteName}` }
  }
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.events)) {
    return { title: `Not found — ${siteName}` }
  }

  const event = await findPublishedEventByPublicKey(decodeURIComponent(slug))
  if (!event) {
    return { title: `Not found — ${siteName}` }
  }

  return {
    title: event.title,
    description: `${event.title} — ${siteName}`,
    robots: event.listed ? undefined : { index: false, follow: false },
  }
}

/**
 * Public event detail (product:events PR2 + PR3 registration).
 * Path: `/[locale]/events/[slug|id]`.
 */
export default async function PublicEventDetailPage({ params }: Args) {
  const { locale: localeParam, slug } = await params
  if (!isValidLocaleCode(localeParam)) {
    notFound()
  }
  const locale = requireContentLocale(localeParam)
  setRequestLocale(locale)

  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.events)) {
    notFound()
  }

  ensureEventsFormHooks()

  const event = await findPublishedEventByPublicKey(decodeURIComponent(slug))
  if (!event) {
    notFound()
  }

  const viewer = await getAccessViewer()
  if (!viewerPassesEventAcl(event, viewer)) {
    notFound()
  }

  const unlocked = await viewerPassesEventPassword(event, viewer)
  if (!unlocked) {
    return (
      <div className="cms-page sf-events-page">
        <EventPasswordGate eventId={event.id} title={event.title} />
      </div>
    )
  }

  const venue = event.venueId ? await findVenueById(event.venueId) : null
  const formsOn = isCatalogModuleEnabled(settings, MODULE_IDS.forms)
  const [organizers, speakers, sponsors, relatedRows, ticketTiers] = await Promise.all([
    listEventPartiesByIds(event.organizerPartyIds),
    listEventPartiesByIds(event.speakerPartyIds),
    listEventPartiesByIds(event.sponsorPartyIds),
    Promise.all(event.relatedEventIds.map((rid) => findEventById(rid))),
    listPublicTicketTiersForEvent(event.id),
  ])
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
      withLocalePrefix(`/events/${encodeURIComponent(eventPublicPathKey(rel))}`, locale),
  )

  return (
    <div className="cms-page sf-events-page">
      <EventDetail
        event={event}
        venueName={venue?.name}
        venueAddress={venue?.address}
        organizers={organizers}
        speakers={speakers}
        sponsors={sponsors}
        relatedEvents={relatedEvents}
        ticketTiers={ticketTiers}
        listHref={withLocalePrefix('/events', locale)}
      />
      {venue?.latitude != null && venue?.longitude != null ? (
        <EventVenueMap
          latitude={venue.latitude}
          longitude={venue.longitude}
          label={venue.name}
        />
      ) : null}
      {formsOn ? <EventRegistrationForm event={event} /> : null}
    </div>
  )
}
