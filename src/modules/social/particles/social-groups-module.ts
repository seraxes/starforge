import React from 'react'
import Link from 'next/link'
import { getLocale } from 'next-intl/server'

import { getAppSession } from '@/core/auth/session'
import { isAppLocale } from '@/core/i18n/locales'
import { withLocalePrefix } from '@/core/i18n/path'
import type { StarforgeModule } from '@/core/modules/types'
import { MODULE_IDS, isCatalogModuleEnabled } from '@/core/settings'

import { groupHref } from '../groups'
import { listMyGroups } from '../groups-store'
import { readSocialGroupsConfig } from './social-groups-config'

/**
 * social-groups particle — groups the viewer belongs to.
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

    if (!userId) {
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

    const groups = await listMyGroups(userId, cfg.limit)

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
      groups.length === 0
        ? React.createElement('p', { className: 'layout-muted' }, cfg.emptyMessage)
        : React.createElement(
            'ul',
            { className: 'sf-social-groups-list' },
            ...groups.map((group) =>
              React.createElement(
                'li',
                { key: group.groupId, className: 'sf-social-groups-item' },
                React.createElement(
                  Link,
                  {
                    href: withLocalePrefix(groupHref(group.slug), locale),
                    className: 'sf-social-groups-link',
                  },
                  React.createElement(
                    'span',
                    { className: 'sf-social-groups-name' },
                    group.name,
                  ),
                  React.createElement(
                    'span',
                    { className: 'layout-muted' },
                    `${group.memberCount} member${group.memberCount === 1 ? '' : 's'}`,
                  ),
                ),
              ),
            ),
          ),
    )
  },
}
