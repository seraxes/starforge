import type { Metadata } from 'next'
import Link from 'next/link'
import { setRequestLocale } from 'next-intl/server'
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

import { listAcceptedFriendIds, listHomeFeedPosts } from '../feed-store'
import { listOwnedGroups } from '../groups-store'
import { loadSocialModuleSettings } from '../settings'
import { listStoryTray, type StoryTrayItem } from '../stories-store'
import { FeedComposer } from './FeedComposer'
import { FeedPostList } from './FeedPostList'
import { FeedTabs } from './FeedTabs'
import { StoryTray, storiesSurfaceHref, type StoryTrayBubble } from './StoryTray'

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
    title: 'Feed',
    description: `Member feed on ${siteName}.`,
  }
}

function authorBubbleLabel(
  authorUserId: string,
  viewerUserId: string,
  personas: Map<string, { displayName?: string | null; handle?: string | null }>,
): string {
  if (authorUserId === viewerUserId) return 'Your story'
  const persona = personas.get(authorUserId)
  if (persona?.displayName?.trim()) return persona.displayName.trim()
  if (persona?.handle?.trim()) return `@${persona.handle.trim()}`
  return 'Story'
}

/** One round cover per author — newest media, unseen ring if any story is unseen. */
function groupStoryBubbles(
  tray: StoryTrayItem[],
  viewerUserId: string,
  locale: string,
  personas: Map<string, { displayName?: string | null; handle?: string | null }>,
): StoryTrayBubble[] {
  const href = storiesSurfaceHref(locale)
  const byAuthor = new Map<
    string,
    { mediaId: string; seen: boolean; isOwn: boolean }
  >()
  for (const row of tray) {
    const authorId = row.story.authorUserId
    const existing = byAuthor.get(authorId)
    if (!existing) {
      byAuthor.set(authorId, {
        mediaId: row.story.mediaId,
        seen: row.seen,
        isOwn: authorId === viewerUserId,
      })
      continue
    }
    if (!row.seen) existing.seen = false
  }

  const bubbles: StoryTrayBubble[] = []
  for (const [authorId, row] of byAuthor) {
    bubbles.push({
      key: authorId,
      mediaId: row.mediaId,
      label: authorBubbleLabel(authorId, viewerUserId, personas),
      seen: row.seen,
      href,
    })
  }
  bubbles.sort((a, b) => {
    const aOwn = a.key === viewerUserId ? 0 : 1
    const bOwn = b.key === viewerUserId ? 0 : 1
    if (aOwn !== bOwn) return aOwn - bOwn
    if (a.seen !== b.seen) return a.seen ? 1 : -1
    return 0
  })
  return bubbles
}

/** Home friends feed + text composer — `/[locale]/feed`. */
export default async function SocialHomeFeedPage({ params }: Args) {
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
    withLocalePrefix('/feed', locale),
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
      <div className="sf-social-feed-page">
        <FeedTabs locale={locale} active="feed" {...tabFlags} />
        <div className="sf-social-feed-column">
          <p className="sf-social-feed-guest-copy">Sign in to see your friends feed and post.</p>
          <p className="sf-social-feed-guest-action">
            <Link className="sf-social-cta" href={loginHref}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    )
  }

  const [posts, ownedGroups, friendIds] = await Promise.all([
    listHomeFeedPosts(userId, { limit: pack.settings.feedPageSize }),
    listOwnedGroups(userId),
    pack.settings.allowStories ? listAcceptedFriendIds(userId) : Promise.resolve([] as string[]),
  ])
  const tray =
    pack.settings.allowStories ? await listStoryTray(userId, friendIds) : []
  const storyAuthorIds = [...new Set(tray.map((row) => row.story.authorUserId))]
  const personas = await getPersonas(
    [...new Set([userId, ...posts.map((p) => p.authorUserId), ...storyAuthorIds])],
    viewer,
  )
  const self = personas.get(userId)
  const authorName =
    self?.displayName?.trim() || (self?.handle?.trim() ? `@${self.handle.trim()}` : 'You')
  const showComposer =
    pack.settings.allowText ||
    pack.settings.allowMedia ||
    pack.settings.allowLink ||
    pack.settings.allowPoll ||
    pack.settings.allowCheckin
  const items = posts.map((post) => ({
    post,
    author: personas.get(post.authorUserId) ?? null,
  }))
  const storyBubbles =
    pack.settings.allowStories && tray.length > 0
      ? groupStoryBubbles(tray, userId, locale, personas)
      : []

  return (
    <div className="sf-social-feed-page">
      <FeedTabs locale={locale} active="feed" {...tabFlags} />
      <div className="sf-social-feed-column">
        {pack.settings.allowStories && storyBubbles.length > 0 ? (
          <section className="sf-social-home-story-tray" aria-label="Stories">
            <StoryTray items={storyBubbles} />
          </section>
        ) : null}
        {showComposer ? (
          <FeedComposer
            ownedGroups={ownedGroups.map((g) => ({ id: g.id, name: g.name }))}
            defaultAudience={pack.settings.defaultPostAudience}
            authorName={authorName}
            authorAvatarSrc={personaMediaSrc(self?.avatarMediaId) || null}
            allowText={pack.settings.allowText}
            allowMedia={pack.settings.allowMedia}
            allowLink={pack.settings.allowLink}
            allowPoll={pack.settings.allowPoll}
            allowCheckin={pack.settings.allowCheckin}
            maxImages={pack.settings.maxImagesPerPost}
            imageMaxWidth={pack.settings.feedImageMaxWidthPx}
            imageMaxHeight={pack.settings.feedImageMaxHeightPx}
          />
        ) : null}
        <FeedPostList
          items={items}
          locale={locale}
          emptyMessage="No posts in your feed yet."
          showShare={pack.settings.allowShare}
          ownedGroups={ownedGroups.map((group) => ({ id: group.id, name: group.name }))}
        />
      </div>
    </div>
  )
}
