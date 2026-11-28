import type { Metadata } from 'next'
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
import { getPersonas } from '@/modules/profiles/api.server'

import { listAcceptedFriendIds } from '../feed-store'
import { loadSocialModuleSettings } from '../settings'
import { listStoryTray, listStoryViewersForAuthor } from '../stories-store'
import { FeedTabs } from './FeedTabs'
import { SocialGuestGate } from './SocialGuestGate'
import { CreateStoryForm, MarkStorySeenButton } from './StoryActions'
import { StoryTray, storiesSurfaceHref, type StoryTrayBubble } from './StoryTray'

type Args = {
  params: Promise<{ locale: string }>
}

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
    title: 'Stories',
    description: `Stories on ${siteName} — 24 hours, then gone.`,
  }
}

/** Stories tray — `/feed/stories`. */
export default async function SocialStoriesPage({ params }: Args) {
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

  const pack = await loadSocialModuleSettings()
  if (!pack.settings.allowStories) notFound()
  const tabFlags = {
    showFollowing: pack.settings.allowFollowingTab,
    showDiscover: pack.settings.allowDiscover,
    showWatch: pack.settings.allowShortVideoLayout,
    showStories: pack.settings.allowStories,
  }

  const userId = session?.user?.id ? String(session.user.id).trim() : ''
  const loginHref = `${withLocalePrefix('/login', locale)}?next=${encodeURIComponent(
    withLocalePrefix('/feed/stories', locale),
  )}`
  const surfaceHref = storiesSurfaceHref(locale)

  if (!userId) {
    return (
      <div className="sf-social-feed-page sf-social-stories-page">
        <FeedTabs locale={locale} active="stories" {...tabFlags} />
        <SocialGuestGate loginHref={loginHref} copyKey="guestSignInStories" />
      </div>
    )
  }

  const [friendIds, t] = await Promise.all([
    listAcceptedFriendIds(userId),
    getTranslations('product:social'),
  ])
  const tray = await listStoryTray(userId, friendIds)
  const ownStories = tray.filter((row) => row.story.authorUserId === userId)
  const friendsStories = tray.filter((row) => row.story.authorUserId !== userId)

  const authorIds = [...new Set(friendsStories.map((row) => row.story.authorUserId))]
  const personas = await getPersonas(authorIds, viewer)

  const friendBubbles: StoryTrayBubble[] = friendsStories.map(({ story, seen }) => {
    const persona = personas.get(story.authorUserId)
    const label =
      persona?.displayName?.trim() ||
      (persona?.handle?.trim() ? `@${persona.handle.trim()}` : t('audienceFriends'))
    return {
      key: story.id,
      mediaId: story.mediaId,
      label,
      seen,
      href: `${surfaceHref}#story-${encodeURIComponent(story.id)}`,
    }
  })

  const ownViewerLists = await Promise.all(
    ownStories.map(async (row) => ({
      storyId: row.story.id,
      viewers: await listStoryViewersForAuthor(row.story.id, userId),
    })),
  )
  const viewersByStory = new Map(ownViewerLists.map((row) => [row.storyId, row.viewers]))

  return (
    <div className="sf-social-feed-page sf-social-stories-page">
      <FeedTabs locale={locale} active="stories" {...tabFlags} />
      <div className="sf-social-feed-column">
        <section className="sf-social-stories-create" aria-label="Post a story">
          <h2 className="sf-social-section-heading">New story</h2>
          <CreateStoryForm />
        </section>

        <section className="sf-social-stories-tray" aria-label="Friends’ stories">
          <h2 className="sf-social-section-heading">Tray</h2>
          <StoryTray
            items={friendBubbles}
            emptyMessage={t('emptyNoStories')}
            ariaLabel="Friends’ stories"
          />
          {friendsStories.length > 0 ? (
            <ul className="sf-social-stories-detail-list">
              {friendsStories.map(({ story, seen }) => (
                <li
                  key={story.id}
                  id={`story-${story.id}`}
                  className="sf-social-stories-detail-item"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- Media library redirect */}
                  <img
                    src={`/api/media/${encodeURIComponent(story.mediaId)}`}
                    alt=""
                    className="sf-social-stories-detail-media"
                  />
                  <div className="sf-social-stories-detail-meta">
                    <span className="layout-muted">
                      {seen ? 'Seen' : 'Unseen'} · expires{' '}
                      {story.expiresAt.toISOString().slice(0, 16).replace('T', ' ')} UTC
                    </span>
                    {!seen ? <MarkStorySeenButton storyId={story.id} /> : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="sf-social-stories-mine" aria-label="Your stories">
          <h2 className="sf-social-section-heading">Your stories</h2>
          {ownStories.length === 0 ? (
            <p className="layout-muted">You have no active stories.</p>
          ) : (
            <ul className="sf-social-stories-detail-list">
              {ownStories.map(({ story }) => {
                const viewers = viewersByStory.get(story.id) ?? []
                return (
                  <li key={story.id} className="sf-social-stories-detail-item">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Media library redirect */}
                    <img
                      src={`/api/media/${encodeURIComponent(story.mediaId)}`}
                      alt=""
                      className="sf-social-stories-detail-media"
                    />
                    <div className="sf-social-stories-detail-meta">
                      <span className="layout-muted">
                        {viewers.length} viewer{viewers.length === 1 ? '' : 's'}
                        {viewers.length > 0 ? ` · ${viewers.join(', ')}` : ''}
                      </span>
                    </div>
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
