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

import { listDiscoverFeedPosts } from '../discover-store'
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
    title: 'Discover',
    description: `Public posts to discover on ${siteName}.`,
  }
}

/** Discover tab — `/[locale]/feed/discover` — personal public posts. */
export default async function SocialDiscoverPage({ params }: Args) {
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
  if (!pack.settings.allowDiscover) notFound()
  const tabFlags = {
    showFollowing: pack.settings.allowFollowingTab,
    showDiscover: pack.settings.allowDiscover,
    showWatch: pack.settings.allowShortVideoLayout,
    showStories: pack.settings.allowStories,
  }

  const userId = session?.user?.id ? String(session.user.id).trim() : ''
  const loginHref = `${withLocalePrefix('/login', locale)}?next=${encodeURIComponent(
    withLocalePrefix('/feed/discover', locale),
  )}`

  if (!userId) {
    return (
      <div className="sf-social-feed-page">
        <FeedTabs locale={locale} active="discover" {...tabFlags} />
        <div className="sf-social-feed-column">
          <p className="sf-social-feed-guest-copy">Sign in to discover public posts.</p>
          <p className="sf-social-feed-guest-action">
            <Link className="sf-social-cta" href={loginHref}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    )
  }

  const posts = await listDiscoverFeedPosts(userId)
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
      <FeedTabs locale={locale} active="discover" {...tabFlags} />
      <div className="sf-social-feed-column">
        <FeedPostList
          items={items}
          locale={locale}
          emptyMessage="No public posts to discover yet."
          showShare={pack.settings.allowShare}
        />
      </div>
    </div>
  )
}
