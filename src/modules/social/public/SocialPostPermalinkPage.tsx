import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import React from 'react'

import { getAccessViewer } from '@/core/acl/access'
import { requireContentLocale } from '@/core/content/pages'
import { isValidLocaleCode } from '@/core/i18n'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'
import { getPersonas } from '@/modules/profiles/api.server'

import { getPostPermalink } from '../posts-store'
import { loadSocialModuleSettings } from '../settings'
import { FeedPostList } from './FeedPostList'
import { FeedTabs } from './FeedTabs'

type Args = { params: Promise<{ locale: string; id: string }> }

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { locale: localeParam, id } = await params
  const [settings, chrome, viewer] = await Promise.all([
    getSiteSettings(),
    getSiteChrome(),
    getAccessViewer(),
  ])
  const siteName = chrome.siteName || settings.siteName
  const notFoundMeta = { title: `Not found — ${siteName}` }

  if (!isValidLocaleCode(localeParam)) return notFoundMeta
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.social)) return notFoundMeta

  const result = await getPostPermalink(viewer.userId?.trim() || null, decodeURIComponent(id))
  if (!result.ok) return notFoundMeta
  return {
    title: 'Post',
    description: `A post on ${siteName}.`,
  }
}

/** Single post permalink — `/feed/post/[id]`. Denied reads are not-found. */
export default async function SocialPostPermalinkPage({ params }: Args) {
  const { locale: localeParam, id } = await params
  if (!isValidLocaleCode(localeParam)) notFound()
  const locale = requireContentLocale(localeParam)
  setRequestLocale(locale)

  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.social)) notFound()

  const pack = await loadSocialModuleSettings()
  const tabFlags = {
    showFollowing: pack.settings.allowFollowingTab,
    showDiscover: pack.settings.allowDiscover,
    showWatch: pack.settings.allowShortVideoLayout,
    showStories: pack.settings.allowStories,
  }

  const viewer = await getAccessViewer()
  const result = await getPostPermalink(
    viewer.userId?.trim() || null,
    decodeURIComponent(id),
  )
  if (!result.ok) notFound()

  const personas = await getPersonas([result.post.authorUserId], viewer)
  const items = [
    {
      post: result.post,
      author: personas.get(result.post.authorUserId) ?? null,
    },
  ]

  return (
    <div className="sf-social-feed-page sf-social-permalink-page">
      <FeedTabs locale={locale} active="feed" {...tabFlags} />
      <div className="sf-social-feed-column">
        <FeedPostList
          items={items}
          locale={locale}
          showShare={pack.settings.allowShare}
          commentsExpanded
        />
      </div>
    </div>
  )
}
