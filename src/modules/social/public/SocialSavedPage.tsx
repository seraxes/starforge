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
import { getPersonas } from '@/modules/profiles/api.server'

import { listSavedFeedPosts } from '../mentions-tags-saves-store'
import { loadSocialModuleSettings } from '../settings'
import { FeedPostList } from './FeedPostList'
import { FeedTabs } from './FeedTabs'

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
    title: 'Saved',
    description: `Posts you saved on ${siteName}.`,
  }
}

/** Saved posts — `/[locale]/feed/saved`. Each row still passes canViewPost. */
export default async function SocialSavedPage({ params }: Args) {
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
  const tabFlags = {
    showFollowing: pack.settings.allowFollowingTab,
    showDiscover: pack.settings.allowDiscover,
    showWatch: pack.settings.allowShortVideoLayout,
    showStories: pack.settings.allowStories,
  }

  const userId = session?.user?.id ? String(session.user.id).trim() : ''
  const loginHref = `${withLocalePrefix('/login', locale)}?next=${encodeURIComponent(
    withLocalePrefix('/feed/saved', locale),
  )}`

  if (!userId) {
    return (
      <div className="sf-social-feed-page">
        <FeedTabs locale={locale} active="saved" {...tabFlags} />
        <div className="sf-social-feed-column">
          <p className="sf-social-feed-guest-copy">Sign in to see posts you saved.</p>
          <p className="sf-social-feed-guest-action">
            <Link className="sf-social-cta" href={loginHref}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    )
  }

  const posts = await listSavedFeedPosts(userId)
  const personas = await getPersonas(
    posts.map((p) => p.authorUserId),
    viewer,
  )
  const items = posts.map((post) => ({
    post,
    author: personas.get(post.authorUserId) ?? null,
  }))

  return (
    <div className="sf-social-feed-page">
      <FeedTabs locale={locale} active="saved" {...tabFlags} />
      <div className="sf-social-feed-column">
        <FeedPostList
          items={items}
          locale={locale}
          emptyMessage="No saved posts yet."
          showShare={pack.settings.allowShare}
          showSave
          savedPostIds={new Set(posts.map((p) => p.id))}
        />
      </div>
    </div>
  )
}
