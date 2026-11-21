import React from 'react'
import Link from 'next/link'
import { getLocale } from 'next-intl/server'

import { getAccessViewer } from '@/core/acl/access'
import { getAppSession } from '@/core/auth/session'
import { isAppLocale } from '@/core/i18n/locales'
import { withLocalePrefix } from '@/core/i18n/path'
import type { StarforgeModule } from '@/core/modules/types'
import { MODULE_IDS, isCatalogModuleEnabled } from '@/core/settings'
import { getPersonas, personaMediaSrc } from '@/modules/profiles/api.server'

import {
  countIncomingFriendRequests,
  listAcceptedFriends,
} from '../feed-store'
import { memberFeedHref } from '../posts'
import { readSocialFriendsConfig } from './social-friends-config'

/**
 * social-friends particle — accepted friends + requests count.
 * Do not reuse the builtin particle id `social` (footer links).
 */
export const socialFriendsModule: StarforgeModule = {
  id: 'social-friends',
  name: 'Social friends',
  description: 'Accepted friends list from product:social.',
  defaultWidth: 33,
  navViews: [
    { key: 'feed', label: 'Social', href: '/feed' },
    { key: 'people', label: 'People', href: '/feed/people' },
  ],
  render: async ({ slot, settings }) => {
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.social)) {
      return null
    }

    const cfg = readSocialFriendsConfig(slot.config)
    const localeRaw = await getLocale()
    const locale = isAppLocale(localeRaw) ? localeRaw : 'en'
    const session = await getAppSession()
    const userId = session?.user?.id ? String(session.user.id).trim() : ''
    const loginHref = `${withLocalePrefix('/login', locale)}?next=${encodeURIComponent(
      withLocalePrefix('/feed', locale),
    )}`

    if (!userId) {
      return React.createElement(
        'section',
        { className: 'sf-social-friends-particle', 'aria-label': cfg.heading || 'Friends' },
        cfg.heading.trim()
          ? React.createElement('h2', { className: 'sf-social-section-heading' }, cfg.heading.trim())
          : null,
        React.createElement(
          'p',
          { className: 'layout-muted' },
          React.createElement(Link, { href: loginHref }, 'Sign in'),
          ' to see your friends.',
        ),
      )
    }

    const viewer = await getAccessViewer()
    const [friends, requestCount] = await Promise.all([
      listAcceptedFriends(userId, cfg.limit),
      countIncomingFriendRequests(userId),
    ])
    const personas = await getPersonas(
      friends.map((f) => f.userId),
      viewer,
    )
    const requestsHref = withLocalePrefix('/feed/requests', locale)

    return React.createElement(
      'section',
      { className: 'sf-social-friends-particle', 'aria-label': cfg.heading || 'Friends' },
      cfg.heading.trim()
        ? React.createElement('h2', { className: 'sf-social-section-heading' }, cfg.heading.trim())
        : null,
      requestCount > 0
        ? React.createElement(
            'p',
            { className: 'sf-social-friends-requests' },
            React.createElement(
              Link,
              { href: requestsHref },
              `${requestCount} friend request${requestCount === 1 ? '' : 's'}`,
            ),
          )
        : React.createElement(
            'p',
            { className: 'sf-social-friends-requests layout-muted' },
            React.createElement(Link, { href: requestsHref }, 'Friend requests'),
          ),
      friends.length === 0
        ? React.createElement('p', { className: 'layout-muted' }, cfg.emptyMessage)
        : React.createElement(
            'ul',
            { className: 'sf-social-friends-list' },
            ...friends.map((friend) => {
              const persona = personas.get(friend.userId)
              const name =
                persona?.displayName?.trim() ||
                (persona?.handle ? `@${persona.handle}` : friend.userId)
              const handle = persona?.handle?.trim() || ''
              const href = handle
                ? withLocalePrefix(memberFeedHref(handle), locale)
                : persona?.href
                  ? withLocalePrefix(persona.href, locale)
                  : withLocalePrefix('/feed', locale)
              const avatar = personaMediaSrc(persona?.avatarMediaId)
              return React.createElement(
                'li',
                { key: friend.friendshipId, className: 'sf-social-friends-item' },
                React.createElement(
                  Link,
                  { href, className: 'sf-social-friends-link' },
                  avatar
                    ? React.createElement('img', {
                        src: avatar,
                        alt: '',
                        width: 40,
                        height: 40,
                        className: 'sf-social-friends-avatar',
                      })
                    : React.createElement(
                        'span',
                        { className: 'sf-social-friends-avatar sf-social-friends-avatar-empty' },
                        name.slice(0, 1).toUpperCase(),
                      ),
                  React.createElement('span', { className: 'sf-social-friends-name' }, name),
                ),
              )
            }),
          ),
    )
  },
}
