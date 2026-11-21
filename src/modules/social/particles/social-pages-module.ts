import React from 'react'
import Link from 'next/link'
import { getLocale } from 'next-intl/server'

import { getAppSession } from '@/core/auth/session'
import { isAppLocale } from '@/core/i18n/locales'
import { withLocalePrefix } from '@/core/i18n/path'
import type { StarforgeModule } from '@/core/modules/types'
import { MODULE_IDS, isCatalogModuleEnabled } from '@/core/settings'

import { pageHref } from '../pages'
import { listMyLikedPages } from '../pages-store'
import { readSocialPagesConfig } from './social-pages-config'

/**
 * social-pages particle — pages the viewer likes.
 * Do not reuse the builtin particle id `social` (footer links).
 */
export const socialPagesModule: StarforgeModule = {
  id: 'social-pages',
  name: 'Social pages',
  description: 'Liked pages from product:social.',
  defaultWidth: 33,
  navViews: [
    { key: 'feed', label: 'Social', href: '/feed' },
    { key: 'pages', label: 'Pages', href: '/feed/pages' },
  ],
  render: async ({ slot, settings }) => {
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.social)) {
      return null
    }

    const cfg = readSocialPagesConfig(slot.config)
    const localeRaw = await getLocale()
    const locale = isAppLocale(localeRaw) ? localeRaw : 'en'
    const session = await getAppSession()
    const userId = session?.user?.id ? String(session.user.id).trim() : ''
    const loginHref = `${withLocalePrefix('/login', locale)}?next=${encodeURIComponent(
      withLocalePrefix('/feed/pages', locale),
    )}`
    const directoryHref = withLocalePrefix('/feed/pages', locale)

    if (!userId) {
      return React.createElement(
        'section',
        { className: 'sf-social-pages-particle', 'aria-label': cfg.heading || 'Pages' },
        cfg.heading.trim()
          ? React.createElement('h2', { className: 'sf-social-section-heading' }, cfg.heading.trim())
          : null,
        React.createElement(
          'p',
          { className: 'layout-muted' },
          React.createElement(Link, { href: loginHref }, 'Sign in'),
          ' to see pages you like.',
        ),
      )
    }

    const pages = await listMyLikedPages(userId, cfg.limit)

    return React.createElement(
      'section',
      { className: 'sf-social-pages-particle', 'aria-label': cfg.heading || 'Pages' },
      cfg.heading.trim()
        ? React.createElement('h2', { className: 'sf-social-section-heading' }, cfg.heading.trim())
        : null,
      React.createElement(
        'p',
        { className: 'sf-social-pages-directory-link' },
        React.createElement(Link, { href: directoryHref }, 'Browse pages'),
      ),
      pages.length === 0
        ? React.createElement('p', { className: 'layout-muted' }, cfg.emptyMessage)
        : React.createElement(
            'ul',
            { className: 'sf-social-pages-list' },
            ...pages.map((page) =>
              React.createElement(
                'li',
                { key: page.pageId, className: 'sf-social-pages-item' },
                React.createElement(
                  Link,
                  {
                    href: withLocalePrefix(pageHref(page.slug), locale),
                    className: 'sf-social-pages-link',
                  },
                  React.createElement(
                    'span',
                    { className: 'sf-social-pages-name' },
                    page.name,
                  ),
                  React.createElement(
                    'span',
                    { className: 'layout-muted' },
                    `${page.likeCount} like${page.likeCount === 1 ? '' : 's'}`,
                  ),
                ),
              ),
            ),
          ),
    )
  },
}
