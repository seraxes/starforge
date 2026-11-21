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

import { listFollowingFeedPosts } from '../follows-store'
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
    title: 'Following',
    description: `Public posts from people you follow on ${siteName}.`,
  }
}

/** Following tab — `/[locale]/feed/following` — public posts from followees. */
export default async function SocialFollowingPage({ params }: Args) {
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
  if (!pack.settings.allowFollowingTab) notFound()
  const tabFlags = {
    showFollowing: pack.settings.allowFollowingTab,
    showDiscover: pack.settings.allowDiscover,
    showWatch: pack.settings.allowShortVideoLayout,
  }

  const userId = session?.user?.id ? String(session.user.id).trim() : ''
  const loginHref = `${withLocalePrefix('/login', locale)}?next=${encodeURIComponent(
    withLocalePrefix('/feed/following', locale),
  )}`

  if (!userId) {
    return (
      <article className="cms-page sf-social-feed-page">
        <header className="cms-page-header">
          <h1>Following</h1>
          <p className="lede">Sign in to see public posts from people you follow.</p>
        </header>
        <FeedTabs locale={locale} active="following" {...tabFlags} />
        <p>
          <Link className="gantry-btn gantry-btn-primary" href={loginHref}>
            Sign in
          </Link>
        </p>
      </article>
    )
  }

  const posts = await listFollowingFeedPosts(userId)
  const personas = await getPersonas(
    posts.map((p) => p.authorUserId),
    viewer,
  )
  const items = posts.map((post) => ({
    post,
    author: personas.get(post.authorUserId) ?? null,
  }))

  return (
    <article className="cms-page sf-social-feed-page">
      <header className="cms-page-header">
        <h1>Following</h1>
        <p className="lede">Public posts from people you follow.</p>
      </header>
      <FeedTabs locale={locale} active="following" {...tabFlags} />
      <FeedPostList
        items={items}
        locale={locale}
        emptyMessage="No public posts from people you follow yet."
        showShare={pack.settings.allowShare}
      />
    </article>
  )
}
