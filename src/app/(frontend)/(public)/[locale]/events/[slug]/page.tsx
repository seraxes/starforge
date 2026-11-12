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
import { findEventCategoryById, publicCategoryLabel } from '@/modules/events/categories'
import { ensureEventsFormHooks } from '@/modules/events/form-hooks'
import { listEventPartiesByIds } from '@/modules/events/parties'
import {
  filterDiscoverableEvents,
  viewerPassesEventPassword,
  viewerPassesEventVisibility,
} from '@/modules/events/public-access'
import {
  EventDetail,
  relatedEventLinksFromRecords,
} from '@/modules/events/public/EventDetail'
import { EventPasswordGate } from '@/modules/events/public/EventPasswordGate'
import { eventPublicPathKey } from '@/modules/events/public/path'
import { signupStatusFromRegistrationStatus } from '@/modules/events/public/signup-status'
import { EventRegistrationForm } from '@/modules/events/public/EventRegistrationForm'
import { EventVenueMap } from '@/modules/events/public/EventVenueMap'
import { EventLiveMap } from '@/modules/maps/public/EventLiveMap'
import { listPublicTicketTiersForEvent } from '@/modules/events/public-tiers'
import {
  countRegisteredGuests,
  findActiveRegistrationForUserOnEvent,
  isEventSelfCancelOpen,
} from '@/modules/events/registrations'
import { resolveEventMediaSrc } from '@/modules/events/public/media-src'
import { loadEventsModuleSettings } from '@/modules/events/settings'
import {
  findEventById,
  findPublishedEventByPublicKey,
  findVenueById,
} from '@/modules/events/store'

type Args = {
  params: Promise<{ locale: string; slug: string }>
  searchParams: Promise<{ tier?: string; cancelled?: string }>
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
 * Public event detail (product:events) — sectioned layout + registration.
 * Path: `/[locale]/events/[slug|id]`.
 */
export default async function PublicEventDetailPage({ params, searchParams }: Args) {
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
  if (!(await viewerPassesEventVisibility(event, viewer))) {
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

  const query = await searchParams
  const preferredTierId = String(query.tier ?? '').trim()
  const justCancelled = String(query.cancelled ?? '').trim() === '1'

  const venue = event.venueId ? await findVenueById(event.venueId) : null
  const category = event.categoryId
    ? await findEventCategoryById(event.categoryId)
    : null
  const categoryLink =
    category && category.published
      ? await publicCategoryLabel(category, locale)
      : null
  const formsOn = isCatalogModuleEnabled(settings, MODULE_IDS.forms)
  const eventPath = withLocalePrefix(
    `/events/${encodeURIComponent(eventPublicPathKey(event))}`,
    locale,
  )
  const manageHref = `${eventPath}/registration`
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
  const relatedVisible = await filterDiscoverableEvents(relatedRows, viewer)
  const relatedById = new Map(relatedVisible.map((r) => [r.id, r] as const))
  const relatedEvents = relatedEventLinksFromRecords(
    event.relatedEventIds,
    relatedById,
    (rel) =>
      withLocalePrefix(`/events/${encodeURIComponent(eventPublicPathKey(rel))}`, locale),
  )

  const signupStatus = signupStatusFromRegistrationStatus(myReg?.status)
  const selfCancelOpen = isEventSelfCancelOpen(event).open
  const canSwitchTier = Boolean(myReg && !myReg.paymentOrderId.trim())

  const venueMap =
    venue?.latitude != null && venue?.longitude != null ? (
      <EventVenueMap
        latitude={venue.latitude}
        longitude={venue.longitude}
        label={venue.name}
        heading=""
      />
    ) : null

  return (
    <div className="cms-page sf-events-page">
      {justCancelled ? (
        <p className="sf-event-ticket-types-feedback" role="status">
          Registration cancelled.
        </p>
      ) : null}
      <EventDetail
        event={event}
        venueName={venue?.name}
        venueAddress={venue?.address}
        categoryTitle={categoryLink?.title}
        categoryHref={categoryLink?.href}
        location={{
          name: venue?.name,
          address: venue?.address,
          latitude: venue?.latitude ?? null,
          longitude: venue?.longitude ?? null,
          map: venueMap,
        }}
        organizers={organizers}
        speakers={speakers}
        sponsors={sponsors}
        relatedEvents={relatedEvents}
        ticketTiers={ticketTiers}
        listHref={withLocalePrefix('/events', locale)}
        occupied={occupied}
        signupStatus={signupStatus}
        coverSrc={coverSrc}
        tierCapacityDisplay={moduleSettings.settings.tierCapacityDisplay}
        eventPath={eventPath}
        loginPath={withLocalePrefix('/login', locale)}
        activeTierId={myReg?.ticketTierId || ''}
        selfCancelOpen={selfCancelOpen}
        canSwitchTier={canSwitchTier}
        manageHref={myReg ? manageHref : ''}
        registrationId={myReg?.id || ''}
      />
      <EventLiveMap eventId={event.id} />
      {formsOn && !myReg ? (
        <EventRegistrationForm event={event} preferredTierId={preferredTierId} />
      ) : null}
    </div>
  )
}
