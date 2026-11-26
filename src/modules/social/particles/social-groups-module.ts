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

import { groupHref } from '../groups'
import {
  listGroupsByIds,
  listGroupsForParticle,
  listMyGroups,
} from '../groups-store'
import { SocialEntityCards, type SocialEntityCard } from './SocialEntityCards'
import { readSocialGroupsConfig } from './social-groups-config'

/**
 * social-groups particle — memberships, selected groups, or directory.
 * Do not reuse the builtin particle id `social` (footer links).
 */
export const socialGroupsModule: StarforgeModule = {
  id: 'social-groups',
  name: 'Social groups',
  description: 'Member groups from product:social.',
  defaultWidth: 33,
  navViews: [
    { key: 'feed', label: 'Social', href: '/feed' },
    { key: 'groups', label: 'Groups', href: '/feed/groups' },
  ],
  render: async ({ slot, settings }) => {
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.social)) {
      return null
    }

    const cfg = readSocialGroupsConfig(slot.config)
    const localeRaw = await getLocale()
    const locale = isAppLocale(localeRaw) ? localeRaw : 'en'
    const session = await getAppSession()
    const userId = session?.user?.id ? String(session.user.id).trim() : ''
    const loginHref = `${withLocalePrefix('/login', locale)}?next=${encodeURIComponent(
      withLocalePrefix('/feed/groups', locale),
    )}`
    const directoryHref = withLocalePrefix('/feed/groups', locale)

    const needsViewer = cfg.source === 'viewer'
    if (needsViewer && !userId) {
      return React.createElement(
        'section',
        { className: 'sf-social-groups-particle', 'aria-label': cfg.heading || 'Groups' },
        cfg.heading.trim()
          ? React.createElement('h2', { className: 'sf-social-section-heading' }, cfg.heading.trim())
          : null,
        React.createElement(
          'p',
          { className: 'layout-muted' },
          React.createElement(Link, { href: loginHref }, 'Sign in'),
          ' to see your groups.',
        ),
      )
    }

    const rows =
      cfg.source === 'groups'
        ? await listGroupsByIds(cfg.scopeIds, cfg.limit)
        : cfg.source === 'all'
          ? await listGroupsForParticle(cfg.limit)
          : await listMyGroups(userId, cfg.limit)

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
        key: row.groupId,
        href: withLocalePrefix(groupHref(row.slug), locale),
        title: row.name,
        imageSrc: personaMediaSrc(row.coverMediaId) || null,
        avatarSrc: personaMediaSrc(persona?.avatarMediaId) || null,
        avatarLabel,
      }
    })

    return React.createElement(
      'section',
      { className: 'sf-social-groups-particle', 'aria-label': cfg.heading || 'Groups' },
      cfg.heading.trim()
        ? React.createElement('h2', { className: 'sf-social-section-heading' }, cfg.heading.trim())
        : null,
      React.createElement(
        'p',
        { className: 'sf-social-groups-directory-link' },
        React.createElement(Link, { href: directoryHref }, 'Browse groups'),
      ),
      React.createElement(SocialEntityCards, {
        items,
        showImages: cfg.showImages,
        emptyMessage: cfg.emptyMessage,
        className: 'sf-social-groups',
      }),
    )
  },
}
