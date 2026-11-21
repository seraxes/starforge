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

import { listHomeFeedPosts } from '../feed-store'
import { listOwnedGroups } from '../groups-store'
import { loadSocialModuleSettings } from '../settings'
import { FeedComposer } from './FeedComposer'
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
    title: 'Social',
    description: `Member feed on ${siteName}.`,
  }
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
  }

  if (!userId) {
    return (
      <article className="cms-page sf-social-feed-page">
        <header className="cms-page-header">
          <h1>Social</h1>
          <p className="lede">Sign in to see your friends feed and post.</p>
        </header>
        <FeedTabs locale={locale} active="friends" {...tabFlags} />
        <p>
          <Link className="gantry-btn gantry-btn-primary" href={loginHref}>
            Sign in
          </Link>
        </p>
      </article>
    )
  }

  const [posts, ownedGroups] = await Promise.all([
    listHomeFeedPosts(userId, { limit: pack.settings.feedPageSize }),
    listOwnedGroups(userId),
  ])
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
        <h1>Social</h1>
        <p className="lede">Your posts, friends, and groups you belong to.</p>
      </header>
      <FeedTabs locale={locale} active="friends" {...tabFlags} />
      {pack.settings.allowText || pack.settings.allowMedia ? (
        <FeedComposer
          ownedGroups={ownedGroups.map((g) => ({ id: g.id, name: g.name }))}
          defaultAudience={pack.settings.defaultPostAudience}
          allowMedia={pack.settings.allowMedia}
        />
      ) : null}
      <FeedPostList
        items={items}
        locale={locale}
        emptyMessage="No posts in your feed yet."
        showShare={pack.settings.allowShare}
      />
    </article>
  )
}
