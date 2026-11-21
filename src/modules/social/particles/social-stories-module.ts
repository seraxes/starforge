import React from 'react'
import Link from 'next/link'
import { getLocale } from 'next-intl/server'

import { getAppSession } from '@/core/auth/session'
import { isAppLocale } from '@/core/i18n/locales'
import { withLocalePrefix } from '@/core/i18n/path'
import type { StarforgeModule } from '@/core/modules/types'
import { MODULE_IDS, isCatalogModuleEnabled } from '@/core/settings'

import { listAcceptedFriendIds } from '../feed-store'
import { listStoryTray } from '../stories-store'
import { readSocialStoriesConfig } from './social-stories-config'

/**
 * social-stories particle — active stories tray (seen / unseen).
 * Do not reuse the builtin particle id `social` (footer links).
 */
export const socialStoriesModule: StarforgeModule = {
  id: 'social-stories',
  name: 'Social stories',
  description: 'Active stories from product:social.',
  defaultWidth: 33,
  navViews: [
    { key: 'feed', label: 'Social', href: '/feed' },
    { key: 'stories', label: 'Stories', href: '/feed/stories' },
  ],
  render: async ({ slot, settings }) => {
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.social)) {
      return null
    }

    const cfg = readSocialStoriesConfig(slot.config)
    const localeRaw = await getLocale()
    const locale = isAppLocale(localeRaw) ? localeRaw : 'en'
    const session = await getAppSession()
    const userId = session?.user?.id ? String(session.user.id).trim() : ''
    const loginHref = `${withLocalePrefix('/login', locale)}?next=${encodeURIComponent(
      withLocalePrefix('/feed/stories', locale),
    )}`
    const directoryHref = withLocalePrefix('/feed/stories', locale)

    if (!userId) {
      return React.createElement(
        'section',
        { className: 'sf-social-stories-particle', 'aria-label': cfg.heading || 'Stories' },
        cfg.heading.trim()
          ? React.createElement('h2', { className: 'sf-social-section-heading' }, cfg.heading.trim())
          : null,
        React.createElement(
          'p',
          { className: 'layout-muted' },
          React.createElement(Link, { href: loginHref }, 'Sign in'),
          ' to see stories.',
        ),
      )
    }

    const friendIds = await listAcceptedFriendIds(userId)
    const tray = await listStoryTray(userId, friendIds, { limit: cfg.limit })

    return React.createElement(
      'section',
      { className: 'sf-social-stories-particle', 'aria-label': cfg.heading || 'Stories' },
      cfg.heading.trim()
        ? React.createElement('h2', { className: 'sf-social-section-heading' }, cfg.heading.trim())
        : null,
      React.createElement(
        'p',
        { className: 'sf-social-stories-directory-link' },
        React.createElement(Link, { href: directoryHref }, 'Open stories'),
      ),
      tray.length === 0
        ? React.createElement('p', { className: 'layout-muted' }, cfg.emptyMessage)
        : React.createElement(
            'ul',
            { className: 'sf-social-stories-list' },
            ...tray.map(({ story, seen }) =>
              React.createElement(
                'li',
                { key: story.id, className: 'sf-social-stories-item' },
                React.createElement(
                  Link,
                  {
                    href: directoryHref,
                    className: 'sf-social-stories-link',
                  },
                  React.createElement(
                    'span',
                    { className: 'sf-social-stories-status' },
                    seen ? 'Seen' : 'Unseen',
                  ),
                  React.createElement(
                    'span',
                    { className: 'layout-muted' },
                    story.authorUserId === userId ? 'You' : story.authorUserId,
                  ),
                ),
              ),
            ),
          ),
    )
  },
}
