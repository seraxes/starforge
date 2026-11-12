import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import React from 'react'

import { requireContentLocale } from '@/core/content/pages'
import { isValidLocaleCode } from '@/core/i18n'
import { withLocalePrefix } from '@/core/i18n/path'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'
import {
  buildDoorCheckInAbsoluteUrl,
  verifyRegistrationTicketToken,
} from '@/modules/events/check-in-ticket'
import { formatEventWhen } from '@/modules/events/public/format'
import { EventRegistrationTicketPage } from '@/modules/events/public/EventRegistrationTicketPage'
import { eventPublicPathKey } from '@/modules/events/public/path'
import { findRegistrationById } from '@/modules/events/registrations'
import { findEventById } from '@/modules/events/store'
import { findTicketTierById } from '@/modules/events/tiers'

type Args = {
  params: Promise<{ locale: string; registrationId: string }>
  searchParams: Promise<{ t?: string }>
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { locale: localeParam } = await params
  const [settings, chrome] = await Promise.all([getSiteSettings(), getSiteChrome()])
  const siteName = chrome.siteName || settings.siteName

  if (!isValidLocaleCode(localeParam)) {
    return { title: `Not found — ${siteName}` }
  }

  return {
    title: `Ticket — ${siteName}`,
    robots: { index: false, follow: false },
  }
}

/**
 * Signed public ticket with door check-in QR.
 * Path: `/[locale]/events/ticket/[registrationId]?t=`
 */
export default async function PublicRegistrationTicketRoute({
  params,
  searchParams,
}: Args) {
  const { locale: localeParam, registrationId } = await params
  if (!isValidLocaleCode(localeParam)) notFound()
  const locale = requireContentLocale(localeParam)
  setRequestLocale(locale)

  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.events)) notFound()

  const id = decodeURIComponent(registrationId || '').trim()
  const query = await searchParams
  if (!verifyRegistrationTicketToken(id, query.t)) notFound()

  const registration = await findRegistrationById(id)
  if (!registration || registration.status !== 'registered') notFound()

  const event = await findEventById(registration.eventId)
  if (!event || event.status === 'cancelled') notFound()

  const tier = registration.ticketTierId
    ? await findTicketTierById(registration.ticketTierId)
    : null

  const eventHref = withLocalePrefix(
    `/events/${encodeURIComponent(eventPublicPathKey(event))}`,
    locale,
  )

  return (
    <div className="cms-page sf-events-page">
      <EventRegistrationTicketPage
        eventTitle={event.title}
        eventWhenLabel={formatEventWhen(event.startsAt, event.endsAt, event.timezone)}
        name={registration.name}
        tierTitle={tier?.title || ''}
        guests={registration.guests}
        checkInUrl={buildDoorCheckInAbsoluteUrl(event.id, registration.id)}
        eventHref={eventHref}
      />
    </div>
  )
}
