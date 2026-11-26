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

import { pageHref } from '../pages'
import {
  listMyLikedPages,
  listPagesByIds,
  listPagesForParticle,
} from '../pages-store'
import { SocialEntityCards, type SocialEntityCard } from './SocialEntityCards'
import { readSocialPagesConfig } from './social-pages-config'

/**
 * social-pages particle — liked pages, selected pages, or directory.
 * Do not reuse the builtin particle id `social` (footer links).
 */
export const socialPagesModule: StarforgeModule = {
  id: 'social-pages',
  name: 'Social pages',
  description: 'Pages from product:social.',
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

    if (cfg.source === 'viewer' && !userId) {
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

    const rows =
      cfg.source === 'groups'
        ? await listPagesByIds(cfg.scopeIds, cfg.limit)
        : cfg.source === 'all'
          ? await listPagesForParticle(cfg.limit)
          : await listMyLikedPages(userId, cfg.limit)

    const viewer = await getAccessViewer()
    const personas = await getPersonas(
      rows.map((row) => row.ownerUserId),
      viewer,
    )

    const items: SocialEntityCard[] = rows.map((row) => {
      const persona = personas.get(row.ownerUserId)
      const avatarLabel =
        persona?.displayName?.trim() ||
        (persona?.handle ? `@${persona.handle}` : row.name)
      return {
        key: row.pageId,
        href: withLocalePrefix(pageHref(row.slug), locale),
        title: row.name,
        imageSrc: personaMediaSrc(row.coverMediaId) || null,
        avatarSrc: personaMediaSrc(persona?.avatarMediaId) || null,
        avatarLabel,
      }
    })

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
      React.createElement(SocialEntityCards, {
        items,
        showImages: cfg.showImages,
        emptyMessage: cfg.emptyMessage,
        className: 'sf-social-pages',
      }),
    )
  },
}
