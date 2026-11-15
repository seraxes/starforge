import Link from 'next/link'
import { setRequestLocale } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import React from 'react'

import { getAppSession } from '@/core/auth/session'
import { requireContentLocale } from '@/core/content/pages'
import { isValidLocaleCode } from '@/core/i18n'
import { withLocalePrefix } from '@/core/i18n/path'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { AccountNav } from '@/modules/profiles/api'
import { ensureProfile } from '@/modules/profiles/api.server'

import { registrationStatusLabel } from '../registration-status'
import { listActiveRegistrationsForUser } from '../registrations'
import { findEventById } from '../store'
import { findTicketTierById } from '../tiers'
import { formatEventWhen } from './format'
import { eventPublicPathKey } from './path'

type Args = { params: Promise<{ locale: string }> }

/**
 * Member list of active event signups. The host route stays in `src/app` and
 * loads this component only when product:events is allowlisted. Profiles nav
 * comes through the profiles public door.
 */
export default async function AccountEventsPage({ params }: Args) {
  const { locale: localeParam } = await params
  if (!isValidLocaleCode(localeParam)) notFound()
  const locale = requireContentLocale(localeParam)
  setRequestLocale(locale)

  const [settings, session] = await Promise.all([getSiteSettings(), getAppSession()])
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.events)) notFound()
  if (!session?.user?.id) {
    redirect(`/login?next=${encodeURIComponent('/account/events')}`)
  }

  const userId = String(session.user.id).trim()
  const profilesOn = isCatalogModuleEnabled(settings, MODULE_IDS.profiles)
  const subscriptionsOn = isCatalogModuleEnabled(settings, MODULE_IDS.subscriptions)
  const [regs, profile] = await Promise.all([
    listActiveRegistrationsForUser(userId),
    profilesOn ? ensureProfile(userId) : Promise.resolve(null),
  ])

  const rows = await Promise.all(
    regs.map(async (reg) => {
      const event = await findEventById(reg.eventId)
      if (!event || event.status !== 'published') return null
      const tier = reg.ticketTierId ? await findTicketTierById(reg.ticketTierId) : null
      const key = eventPublicPathKey(event)
      const eventHref = withLocalePrefix(`/events/${encodeURIComponent(key)}`, locale)
      const manageHref = `${eventHref}/registration`
      return {
        id: reg.id,
        title: event.title,
        when: event.startsAt
          ? formatEventWhen(event.startsAt, event.endsAt, event.timezone)
          : '',
        status: registrationStatusLabel(reg.status),
        tierTitle: tier?.title || '',
        eventHref,
        manageHref,
      }
    }),
  )
  const items = rows.filter((r): r is NonNullable<typeof r> => Boolean(r))

  return (
    <article className="cms-page sf-profile-page sf-account-events-page">
      <header className="cms-page-header">
        <h1>My events</h1>
      </header>
      {profilesOn ? (
        <AccountNav
          active="events"
          locale={locale}
          handle={profile?.handle}
          showSubscriptions={subscriptionsOn}
        />
      ) : null}
      <p className="lede">
        Your active event signups. Open a registration to cancel before the organizer
        deadline when enabled.
      </p>
      {items.length === 0 ? (
        <p className="settings-hint">You have no active event registrations.</p>
      ) : (
        <ul className="sf-account-events-list">
          {items.map((item) => (
            <li key={item.id} className="sf-account-events-item">
              <div className="sf-account-events-item-body">
                <Link href={item.eventHref} className="sf-account-events-title">
                  {item.title}
                </Link>
                {item.when ? <p className="settings-hint">{item.when}</p> : null}
                <p className="settings-hint">
                  {item.status}
                  {item.tierTitle ? ` · ${item.tierTitle}` : ''}
                </p>
              </div>
              <div className="sf-account-events-item-actions">
                <Link href={item.manageHref} className="gantry-btn">
                  Edit / Cancel
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="settings-hint">
        <Link href={withLocalePrefix('/events', locale)}>Browse events</Link>
      </p>
    </article>
  )
}
