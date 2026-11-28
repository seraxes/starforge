import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import React from 'react'

import { getAccessViewer } from '@/core/acl/access'
import { getAppSession } from '@/core/auth/session'
import { requireContentLocale } from '@/core/content/pages'
import { isValidLocaleCode } from '@/core/i18n'
import { withLocalePrefix } from '@/core/i18n/path'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'
import { getPersonas, personaMediaSrc } from '@/modules/profiles/api.server'

import { formatMutualFriendCount } from '../people'
import { memberFeedHref } from '../posts'
import {
  countMutualFriendsBetween,
  listIncomingFriendRequests,
  listPeopleDirectory,
  listPeopleSuggestions,
} from '../people-store'
import { loadSocialModuleSettings } from '../settings'
import { FeedTabs } from './FeedTabs'
import { IncomingRequestActions, RequestFriendButton } from './PeopleActions'
import { SocialGuestGate } from './SocialGuestGate'

type Args = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { locale: localeParam } = await params
  const [settings, chrome] = await Promise.all([getSiteSettings(), getSiteChrome()])
  const siteName = chrome.siteName || settings.siteName

  if (!isValidLocaleCode(localeParam)) {
    return { title: `Not found — ${siteName}` }
  }
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.social)) {
    return { title: `Not found — ${siteName}` }
  }

  return {
    title: 'People',
    description: `Find people on ${siteName}.`,
  }
}

/** People directory — `/feed/people`. Omits hidden and blocked members. */
export default async function SocialPeoplePage({ params }: Args) {
  const { locale: localeParam } = await params
  if (!isValidLocaleCode(localeParam)) notFound()
  const locale = requireContentLocale(localeParam)
  setRequestLocale(locale)

  const [settings, session, viewer] = await Promise.all([
    getSiteSettings(),
    getAppSession(),
    getAccessViewer(),
  ])
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.social)) notFound()

  const userId = session?.user?.id ? String(session.user.id).trim() : ''
  const loginHref = `${withLocalePrefix('/login', locale)}?next=${encodeURIComponent(
    withLocalePrefix('/feed/people', locale),
  )}`

  const pack = await loadSocialModuleSettings()
  const tabFlags = {
    showFollowing: pack.settings.allowFollowingTab,
    showDiscover: pack.settings.allowDiscover,
    showWatch: pack.settings.allowShortVideoLayout,
    showStories: pack.settings.allowStories,
  }

  if (!userId) {
    return (
      <div className="sf-social-feed-page sf-social-people-page">
        <FeedTabs locale={locale} active="people" {...tabFlags} />
        <SocialGuestGate loginHref={loginHref} copyKey="guestSignInPeople" />
      </div>
    )
  }

  const [people, incoming, suggestions, t] = await Promise.all([
    listPeopleDirectory(userId),
    listIncomingFriendRequests(userId),
    listPeopleSuggestions(userId),
    getTranslations('product:social'),
  ])
  const personaIds = [
    ...people.map((p) => p.userId),
    ...incoming.map((r) => r.requesterId),
    ...suggestions.map((s) => s.userId),
  ]
  const [personas, incomingMutuals] = await Promise.all([
    getPersonas(personaIds, viewer),
    Promise.all(
      incoming.map(async (row) => ({
        friendshipId: row.friendshipId,
        mutualFriendCount: await countMutualFriendsBetween(userId, row.requesterId),
      })),
    ),
  ])
  const mutualByRequest = new Map(
    incomingMutuals.map((row) => [row.friendshipId, row.mutualFriendCount]),
  )

  return (
    <div className="sf-social-feed-page sf-social-people-page">
      <FeedTabs locale={locale} active="people" {...tabFlags} />
      <div className="sf-social-feed-column">
        <section className="sf-social-people-requests" aria-label={t('friendRequestsAriaLabel')}>
          <h2 className="sf-social-section-heading">{t('friendRequests')}</h2>
          {incoming.length === 0 ? (
            <p className="layout-muted">{t('emptyNoPendingFriendRequests')}</p>
          ) : (
            <ul className="sf-social-people-list">
              {incoming.map((row) => {
                const persona = personas.get(row.requesterId)
                const name =
                  persona?.displayName?.trim() ||
                  (persona?.handle ? `@${persona.handle}` : row.requesterId)
                const handle = persona?.handle?.trim() || ''
                const href = handle
                  ? withLocalePrefix(memberFeedHref(handle), locale)
                  : withLocalePrefix('/feed', locale)
                const avatar = personaMediaSrc(persona?.avatarMediaId)
                const mutualLabel = formatMutualFriendCount(
                  mutualByRequest.get(row.friendshipId) ?? 0,
                )
                return (
                  <li key={row.friendshipId} className="sf-social-people-item">
                    <Link href={href} className="sf-social-people-link">
                      {avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatar}
                          alt=""
                          className="sf-social-people-avatar"
                          width={40}
                          height={40}
                        />
                      ) : (
                        <span className="sf-social-people-avatar sf-social-people-avatar-empty" />
                      )}
                      <span className="sf-social-people-copy">
                        <span className="sf-social-people-name">{name}</span>
                        {mutualLabel ? (
                          <span className="sf-social-people-mutual layout-muted">{mutualLabel}</span>
                        ) : null}
                      </span>
                    </Link>
                    <IncomingRequestActions userId={row.requesterId} />
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {suggestions.length > 0 ? (
          <section className="sf-social-people-suggestions" aria-label={t('peopleYouMayKnow')}>
            <h2 className="sf-social-section-heading">{t('peopleYouMayKnow')}</h2>
            <ul className="sf-social-people-list">
              {suggestions.map((row) => {
                const persona = personas.get(row.userId)
                const name =
                  persona?.displayName?.trim() ||
                  row.displayName ||
                  (row.handle ? `@${row.handle}` : row.userId)
                const handle = (persona?.handle || row.handle).trim()
                const href = handle
                  ? withLocalePrefix(memberFeedHref(handle), locale)
                  : withLocalePrefix('/feed', locale)
                const avatar = personaMediaSrc(persona?.avatarMediaId || row.avatarMediaId)
                const mutualLabel = formatMutualFriendCount(row.mutualFriendCount)
                return (
                  <li key={row.userId} className="sf-social-people-item">
                    <Link href={href} className="sf-social-people-link">
                      {avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatar}
                          alt=""
                          className="sf-social-people-avatar"
                          width={40}
                          height={40}
                        />
                      ) : (
                        <span className="sf-social-people-avatar sf-social-people-avatar-empty" />
                      )}
                      <span className="sf-social-people-copy">
                        <span className="sf-social-people-name">{name}</span>
                        {mutualLabel ? (
                          <span className="sf-social-people-mutual layout-muted">{mutualLabel}</span>
                        ) : null}
                      </span>
                    </Link>
                    <RequestFriendButton userId={row.userId} />
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null}

        <section className="sf-social-people-directory" aria-label={t('peopleDirectory')}>
          <h2 className="sf-social-section-heading">{t('peopleDirectory')}</h2>
          {people.length === 0 ? (
            <p className="layout-muted">{t('emptyNoPeople')}</p>
          ) : (
            <ul className="sf-social-people-list">
              {people.map((row) => {
                const persona = personas.get(row.userId)
                const name =
                  persona?.displayName?.trim() ||
                  row.displayName ||
                  (row.handle ? `@${row.handle}` : row.userId)
                const handle = (persona?.handle || row.handle).trim()
                const href = handle
                  ? withLocalePrefix(memberFeedHref(handle), locale)
                  : withLocalePrefix('/feed', locale)
                const avatar = personaMediaSrc(persona?.avatarMediaId || row.avatarMediaId)
                return (
                  <li key={row.userId} className="sf-social-people-item">
                    <Link href={href} className="sf-social-people-link">
                      {avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatar}
                          alt=""
                          className="sf-social-people-avatar"
                          width={40}
                          height={40}
                        />
                      ) : (
                        <span className="sf-social-people-avatar sf-social-people-avatar-empty" />
                      )}
                      <span className="sf-social-people-copy">
                        <span className="sf-social-people-name">{name}</span>
                      </span>
                    </Link>
                    <RequestFriendButton userId={row.userId} />
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
