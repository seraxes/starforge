import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import React from 'react'

import { getAccessViewer } from '@/core/acl/access'
import { getAppSession } from '@/core/auth/session'
import { requireContentLocale } from '@/core/content/pages'
import { isValidLocaleCode } from '@/core/i18n'
import { withLocalePrefix } from '@/core/i18n/path'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'
import {
  viewerPassesEventAcl,
  viewerPassesEventPassword,
} from '@/modules/events/public-access'
import { formatEventWhen } from '@/modules/events/public/format'
import { MyRegistrationManage } from '@/modules/events/public/MyRegistrationManage'
import { eventPublicPathKey } from '@/modules/events/public/path'
import { buildDoorCheckInAbsoluteUrl } from '@/modules/events/check-in-ticket'
import {
  findActiveRegistrationForUserOnEvent,
  isEventSelfCancelOpen,
} from '@/modules/events/registrations'
import { findPublishedEventByPublicKey } from '@/modules/events/store'
import { findTicketTierById } from '@/modules/events/tiers'

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
    title: `My registration — ${event.title}`,
    robots: { index: false, follow: false },
  }
}

/**
 * Public manage-my-signup for one event (cancel before deadline).
 * Path: `/[locale]/events/[slug]/registration`.
 */
export default async function EventMyRegistrationPage({ params }: Args) {
  const { locale: localeParam, slug } = await params
  if (!isValidLocaleCode(localeParam)) notFound()
  const locale = requireContentLocale(localeParam)
  setRequestLocale(locale)

  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.events)) notFound()

  const event = await findPublishedEventByPublicKey(decodeURIComponent(slug))
  if (!event) notFound()

  const eventPath = withLocalePrefix(
    `/events/${encodeURIComponent(eventPublicPathKey(event))}`,
    locale,
  )
  const loginPath = withLocalePrefix('/login', locale)

  const session = await getAppSession()
  if (!session?.user?.id) {
    const nextPath = `/events/${encodeURIComponent(eventPublicPathKey(event))}/registration`
    redirect(`${loginPath}?next=${encodeURIComponent(nextPath)}`)
  }

  const viewer = await getAccessViewer()
  if (!viewerPassesEventAcl(event, viewer)) notFound()
  if (!(await viewerPassesEventPassword(event, viewer))) {
    redirect(eventPath)
  }

  const userId = String(session.user.id).trim()
  const registration = await findActiveRegistrationForUserOnEvent(userId, event.id)
  if (!registration) {
    redirect(eventPath)
  }

  const tier = registration.ticketTierId
    ? await findTicketTierById(registration.ticketTierId)
    : null
  const cancelWindow = isEventSelfCancelOpen(event)
  const paid = Boolean(registration.paymentOrderId.trim())
  const canRequestRefund =
    paid &&
    event.selfCancelRefund &&
    registration.status === 'registered'

  const statusLabel =
    registration.status === 'waitlisted'
      ? 'On waitlist'
      : registration.status === 'pending_payment'
        ? 'Pending payment'
        : 'Registered'

  return (
    <div className="cms-page sf-events-page">
      <article className="sf-event-detail">
        <header className="sf-event-detail-header">
          <p className="sf-event-detail-kicker">
            <a href={eventPath}>← {event.title}</a>
          </p>
          <h1 className="sf-event-detail-title">My registration</h1>
          <p className="lede">
            View your signup, show your door QR when confirmed, and cancel before the
            organizer deadline when enabled.
          </p>
        </header>
        <MyRegistrationManage
          registrationId={registration.id}
          eventHref={eventPath}
          statusLabel={statusLabel}
          tierTitle={tier?.title || ''}
          guests={registration.guests}
          cancelOpen={cancelWindow.open}
          cancelClosedReason={cancelWindow.reason}
          cancelDeadlineLabel={
            event.cancellationClosesAt
              ? formatEventWhen(event.cancellationClosesAt, null, event.timezone)
              : undefined
          }
          canRequestRefund={canRequestRefund}
          loginPath={loginPath}
          showDoorQr={registration.status === 'registered'}
          checkInUrl={
            registration.status === 'registered'
              ? buildDoorCheckInAbsoluteUrl(event.id, registration.id)
              : ''
          }
          attendeeName={registration.name}
        />
      </article>
    </div>
  )
}
