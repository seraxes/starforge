import React from 'react'
import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { getLocale } from 'next-intl/server'

import { getAccessViewer } from '@/core/acl/access'
import { getAppSession } from '@/core/auth/session'
import { db } from '@/core/db'
import { isAppLocale } from '@/core/i18n/locales'
import { withLocalePrefix } from '@/core/i18n/path'
import type { StarforgeModule } from '@/core/modules/types'
import { MODULE_IDS, isCatalogModuleEnabled } from '@/core/settings'
import { getPersonas, personaMediaSrc } from '@/modules/profiles/api.server'

import { listAlbumsForParticle } from '../albums-store'
import { sfSocialAlbums } from '../schema'
import { SocialAlbumImages } from './SocialAlbumImages'
import { readSocialAlbumsConfig } from './social-albums-config'

async function loadHandleMap(
  viewerUserId: string,
  source: 'viewer' | 'groups' | 'all',
): Promise<Map<string, string>> {
  const viewer = await getAccessViewer()
  const userIds = new Set<string>([viewerUserId])

  if (source === 'all') {
    try {
      const rows = await db
        .select({ ownerId: sfSocialAlbums.ownerId })
        .from(sfSocialAlbums)
        .where(eq(sfSocialAlbums.ownerType, 'user'))
        .orderBy(desc(sfSocialAlbums.createdAt))
        .limit(80)
      for (const row of rows) {
        if (row.ownerId) userIds.add(row.ownerId)
      }
    } catch {
      // Table missing — viewer handle only.
    }
  }

  const personas = await getPersonas([...userIds], viewer)
  const handleByUserId = new Map<string, string>()
  for (const [id, persona] of personas) {
    const handle = persona.handle?.trim()
    if (handle) handleByUserId.set(id, handle)
  }
  return handleByUserId
}

/**
 * social-albums particle — image-only album covers.
 * Do not reuse the builtin particle id `social` (footer links).
 */
export const socialAlbumsModule: StarforgeModule = {
  id: 'social-albums',
  name: 'Social albums',
  description: 'Album images from product:social.',
  defaultWidth: 50,
  navViews: [{ key: 'feed', label: 'Social', href: '/feed' }],
  render: async ({ slot, settings }) => {
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.social)) {
      return null
    }

    const cfg = readSocialAlbumsConfig(slot.config)
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
        { className: 'sf-social-albums-particle', 'aria-label': cfg.heading || 'Albums' },
        cfg.heading.trim()
          ? React.createElement('h2', { className: 'sf-social-section-heading' }, cfg.heading.trim())
          : null,
        React.createElement(
          'p',
          { className: 'layout-muted' },
          React.createElement(Link, { href: loginHref }, 'Sign in'),
          ' to see album images.',
        ),
      )
    }

    const handleByUserId = await loadHandleMap(userId, cfg.source)
    const items = await listAlbumsForParticle({
      source: cfg.source,
      viewerUserId: userId,
      groupIds: cfg.scopeIds,
      limit: cfg.limit,
      handleByUserId,
    })

    const cards = items
      .map((row) => {
        const imageSrc = personaMediaSrc(row.imageMediaId)
        if (!imageSrc) return null
        return {
          key: row.albumId,
          href: withLocalePrefix(row.href, locale),
          imageSrc,
          title: row.title,
        }
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))

    return React.createElement(
      'section',
      { className: 'sf-social-albums-particle', 'aria-label': cfg.heading || 'Albums' },
      cfg.heading.trim()
        ? React.createElement('h2', { className: 'sf-social-section-heading' }, cfg.heading.trim())
        : null,
      React.createElement(SocialAlbumImages, {
        items: cards,
        emptyMessage: cfg.emptyMessage,
      }),
    )
  },
}
