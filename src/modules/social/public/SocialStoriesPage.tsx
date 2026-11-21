import type { Metadata } from 'next'
import Link from 'next/link'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import React from 'react'

import { getAppSession } from '@/core/auth/session'
import { requireContentLocale } from '@/core/content/pages'
import { isValidLocaleCode } from '@/core/i18n'
import { withLocalePrefix } from '@/core/i18n/path'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'

import { listAcceptedFriendIds } from '../feed-store'
import { listStoryTray, listStoryViewersForAuthor } from '../stories-store'
import { CreateStoryForm, MarkStorySeenButton } from './StoryActions'

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

  const [settings, session] = await Promise.all([getSiteSettings(), getAppSession()])
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.social)) notFound()

  const userId = session?.user?.id ? String(session.user.id).trim() : ''
  const loginHref = `${withLocalePrefix('/login', locale)}?next=${encodeURIComponent(
    withLocalePrefix('/feed/stories', locale),
  )}`

  const friendIds = userId ? await listAcceptedFriendIds(userId) : []
  const tray = userId
    ? await listStoryTray(userId, friendIds)
    : []

  const ownStories = tray.filter((row) => row.story.authorUserId === userId)
  const friendsStories = tray.filter((row) => row.story.authorUserId !== userId)

  const ownViewerLists = await Promise.all(
    ownStories.map(async (row) => ({
      storyId: row.story.id,
      viewers: await listStoryViewersForAuthor(row.story.id, userId),
    })),
  )
  const viewersByStory = new Map(ownViewerLists.map((row) => [row.storyId, row.viewers]))

  return (
    <article className="cms-page sf-social-stories-page">
      <header className="cms-page-header">
        <h1>Stories</h1>
        <p className="lede">Share a photo or video for 24 hours. Expired stories are hidden.</p>
      </header>

      {userId ? (
        <section className="sf-social-stories-create" aria-label="Post a story">
          <h2 className="sf-social-section-heading">New story</h2>
          <CreateStoryForm />
        </section>
      ) : (
        <p>
          <Link className="gantry-btn gantry-btn-primary" href={loginHref}>
            Sign in
          </Link>{' '}
          to post or view stories.
        </p>
      )}

      {userId ? (
        <>
          <section className="sf-social-stories-tray" aria-label="Friends’ stories">
            <h2 className="sf-social-section-heading">Tray</h2>
            {friendsStories.length === 0 ? (
              <p className="layout-muted">No active stories from friends.</p>
            ) : (
              <ul className="sf-social-stories-list">
                {friendsStories.map(({ story, seen }) => (
                  <li key={story.id} className="sf-social-stories-item">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Media library redirect */}
                    <img
                      src={`/api/media/${encodeURIComponent(story.mediaId)}`}
                      alt=""
                      className="sf-social-composer-media-thumb"
                    />
                    <span className="layout-muted">
                      {seen ? 'Seen' : 'Unseen'} · expires{' '}
                      {story.expiresAt.toISOString().slice(0, 16).replace('T', ' ')} UTC
                    </span>
                    {!seen ? <MarkStorySeenButton storyId={story.id} /> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="sf-social-stories-mine" aria-label="Your stories">
            <h2 className="sf-social-section-heading">Your stories</h2>
            {ownStories.length === 0 ? (
              <p className="layout-muted">You have no active stories.</p>
            ) : (
              <ul className="sf-social-stories-list">
                {ownStories.map(({ story }) => {
                  const viewers = viewersByStory.get(story.id) ?? []
                  return (
                    <li key={story.id} className="sf-social-stories-item">
                      {/* eslint-disable-next-line @next/next/no-img-element -- Media library redirect */}
                      <img
                        src={`/api/media/${encodeURIComponent(story.mediaId)}`}
                        alt=""
                        className="sf-social-composer-media-thumb"
                      />
                      <span className="layout-muted">
                        {viewers.length} viewer{viewers.length === 1 ? '' : 's'}
                        {viewers.length > 0 ? ` · ${viewers.join(', ')}` : ''}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </article>
  )
}
