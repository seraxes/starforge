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

import { loadSocialModuleSettings } from '../settings'
import { listShortVideoLayoutPosts } from '../short-video-store'
import { FeedTabs } from './FeedTabs'
import { ShortVideoLayout } from './ShortVideoLayout'

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
    title: 'Watch',
    description: `Short-video layout on ${siteName}.`,
  }
}

/** Short-video layout — `/[locale]/feed/watch` — single-video posts fullscreen. */
export default async function SocialShortVideoPage({ params }: Args) {
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
  if (!pack.settings.allowShortVideoLayout) notFound()
  const tabFlags = {
    showFollowing: pack.settings.allowFollowingTab,
    showDiscover: pack.settings.allowDiscover,
    showWatch: pack.settings.allowShortVideoLayout,
  }

  const userId = session?.user?.id ? String(session.user.id).trim() : ''
  const loginHref = `${withLocalePrefix('/login', locale)}?next=${encodeURIComponent(
    withLocalePrefix('/feed/watch', locale),
  )}`

  if (!userId) {
    return (
      <article className="cms-page sf-social-feed-page sf-social-short-video-page">
        <header className="cms-page-header">
          <h1>Watch</h1>
          <p className="lede">Sign in to watch short videos from your feed.</p>
        </header>
        <FeedTabs locale={locale} active="watch" {...tabFlags} />
        <p>
          <Link className="gantry-btn gantry-btn-primary" href={loginHref}>
            Sign in
          </Link>
        </p>
      </article>
    )
  }

  const posts = await listShortVideoLayoutPosts(userId)
  const personas = await getPersonas(
    posts.map((p) => p.authorUserId),
    viewer,
  )
  const items = posts.map((post) => ({
    post,
    author: personas.get(post.authorUserId) ?? null,
  }))

  return (
    <article className="cms-page sf-social-feed-page sf-social-short-video-page">
      <header className="cms-page-header">
        <h1>Watch</h1>
        <p className="lede">Fullscreen short-video layout on your feed’s video posts.</p>
      </header>
      <FeedTabs locale={locale} active="watch" {...tabFlags} />
      <ShortVideoLayout
        items={items}
        locale={locale}
        emptyMessage="No short videos in your feed yet."
      />
    </article>
  )
}
