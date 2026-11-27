import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import React from 'react'

import { getAccessViewer } from '@/core/acl/access'
import { getAppSession } from '@/core/auth/session'
import { requireContentLocale } from '@/core/content/pages'
import { isValidLocaleCode } from '@/core/i18n'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'
import {
  getPersonaByHandle,
  getPersonas,
  PublicProfile,
} from '@/modules/profiles/api.server'

import { canViewAlbum } from '../albums'
import { listAlbumItems, listAlbumsForOwner } from '../albums-store'
import { listMemberFeedPosts } from '../feed-store'
import { findFollow } from '../follows-store'
import { areBlocked } from '../friends-store'
import { getMemberBannedAt, isMemberAccountHidden } from '../members-store'
import { formatMutualFriendCount } from '../people'
import { countMutualFriendsBetween } from '../people-store'
import { isReservedFeedHandle } from '../posts'
import { AlbumList, CreateAlbumForm } from './AlbumActions'
import { FeedPostList } from './FeedPostList'
import { FollowButton, UnfollowButton } from './FollowActions'

type Args = {
  params: Promise<{ locale: string; handle: string }>
  /** When true, only reserved handles resolve (route `/feed/u/[handle]`). */
  reservedOnly?: boolean
}

async function loadMember(
  handleRaw: string,
  viewer: Awaited<ReturnType<typeof getAccessViewer>>,
  reservedOnly: boolean,
) {
  const handle = decodeURIComponent(handleRaw).trim()
  if (!handle) return null
  if (reservedOnly && !isReservedFeedHandle(handle)) return null
  if (!reservedOnly && isReservedFeedHandle(handle)) return null
  return getPersonaByHandle(handle, viewer)
}

export async function generateMetadata({
  params,
  reservedOnly = false,
}: Args): Promise<Metadata> {
  const { locale: localeParam, handle } = await params
  const [settings, chrome, viewer] = await Promise.all([
    getSiteSettings(),
    getSiteChrome(),
    getAccessViewer(),
  ])
  const siteName = chrome.siteName || settings.siteName
  const notFoundMeta = { title: `Not found — ${siteName}` }

  if (!isValidLocaleCode(localeParam)) return notFoundMeta
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.social)) return notFoundMeta

  const found = await loadMember(handle, viewer, reservedOnly)
  if (!found) return notFoundMeta
  return {
    title: found.persona.displayName,
    description: found.persona.headline || `${found.persona.displayName} on ${siteName}`,
  }
}

/** Member wall under `/feed/[handle]` or `/feed/u/[handle]` for reserved words. */
export default async function SocialMemberFeedPage({
  params,
  reservedOnly = false,
}: Args) {
  const { locale: localeParam, handle } = await params
  if (!isValidLocaleCode(localeParam)) notFound()
  const locale = requireContentLocale(localeParam)
  setRequestLocale(locale)

  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.social)) notFound()

  const viewer = await getAccessViewer()
  const found = await loadMember(handle, viewer, reservedOnly)
  if (!found) notFound()

  const viewerId = viewer.userId?.trim() || null
  const ownerUserId = found.persona.userId
  const posts = await listMemberFeedPosts(viewerId, ownerUserId)
  const personas = await getPersonas(
    posts.map((p) => p.authorUserId),
    viewer,
  )
  const items = posts.map((post) => ({
    post,
    author: personas.get(post.authorUserId) ?? null,
  }))

  const session = await getAppSession()
  const sessionUserId = session?.user?.id ? String(session.user.id).trim() : ''
  const isOwner = Boolean(sessionUserId && sessionUserId === ownerUserId)

  const allAlbums = await listAlbumsForOwner('user', ownerUserId)
  const [blocked, viewerHidden, ownerHidden, viewerBannedAt, ownerBannedAt] =
    viewerId && viewerId !== ownerUserId
      ? await Promise.all([
          areBlocked(viewerId, ownerUserId),
          isMemberAccountHidden(viewerId),
          isMemberAccountHidden(ownerUserId),
          getMemberBannedAt(viewerId),
          getMemberBannedAt(ownerUserId),
        ])
      : [false, false, false, null, null]
  const interact = {
    isBlocked: blocked,
    actorHidden: viewerHidden,
    otherHidden: ownerHidden,
    actorBannedAt: viewerBannedAt,
    otherBannedAt: ownerBannedAt,
  }
  const visibleAlbums = allAlbums.filter((album) =>
    canViewAlbum(album, {
      viewerUserId: viewerId || '',
      interact,
    }),
  )
  const itemsByAlbum = new Map(
    await Promise.all(
      visibleAlbums.map(async (album) => [album.id, await listAlbumItems(album.id)] as const),
    ),
  )

  const existingFollow =
    sessionUserId && sessionUserId !== ownerUserId
      ? await findFollow(sessionUserId, ownerUserId)
      : null
  const canOfferFollow =
    Boolean(sessionUserId) &&
    !isOwner &&
    !interact.isBlocked &&
    !interact.actorHidden &&
    !interact.otherHidden

  const mutualFriendCount =
    sessionUserId && sessionUserId !== ownerUserId && !interact.isBlocked
      ? await countMutualFriendsBetween(sessionUserId, ownerUserId)
      : 0
  const mutualLabel = formatMutualFriendCount(mutualFriendCount)

  return (
    <article className="cms-page sf-social-member-page">
      <PublicProfile
        persona={found.persona}
        locale={locale}
        memberSince={found.createdAt}
        adminEditHref={
          viewer.isAppAdmin ? `/admin/profiles/${found.persona.userId}` : undefined
        }
      />
      {mutualLabel ? (
        <p className="sf-social-member-mutual layout-muted" aria-label="Mutual friends">
          {mutualLabel}
        </p>
      ) : null}
      {canOfferFollow ? (
        <section className="sf-social-member-follow admin-control-row" aria-label="Follow">
          {existingFollow ? (
            <UnfollowButton userId={ownerUserId} />
          ) : (
            <FollowButton userId={ownerUserId} />
          )}
        </section>
      ) : null}
      <section className="sf-social-member-albums" aria-label="Albums">
        <h2>Albums</h2>
        {isOwner ? <CreateAlbumForm ownerType="user" ownerId={ownerUserId} /> : null}
        <AlbumList
          albums={visibleAlbums}
          itemsByAlbum={itemsByAlbum}
          canManage={isOwner}
        />
      </section>
      <section className="sf-social-member-wall" aria-label="Posts">
        <h2>Posts</h2>
        <FeedPostList
          items={items}
          locale={locale}
          emptyMessage="No visible posts."
          showShare
        />
      </section>
    </article>
  )
}
