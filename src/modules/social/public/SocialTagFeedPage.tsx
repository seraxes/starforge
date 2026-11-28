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

import { listTagFeedPosts } from '../mentions-tags-saves-store'
import { normalizeTag } from '../mentions-tags-saves'
import { loadSocialModuleSettings } from '../settings'
import { FeedPostList } from './FeedPostList'
import { FeedTabs } from './FeedTabs'

type Args = { params: Promise<{ locale: string; tag: string }> }

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { locale: localeParam, tag: tagParam } = await params
  const [settings, chrome] = await Promise.all([getSiteSettings(), getSiteChrome()])
  const siteName = chrome.siteName || settings.siteName
  const tag = normalizeTag(decodeURIComponent(tagParam ?? ''))

  if (!isValidLocaleCode(localeParam) || !tag) {
    return { title: `Not found — ${siteName}` }
  }
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.social)) {
    return { title: `Not found — ${siteName}` }
  }

  return {
    title: `#${tag}`,
    description: `Posts tagged #${tag} on ${siteName}.`,
  }
}

/** Hashtag feed — `/[locale]/feed/tag/[tag]`. Uses canViewPost per post. */
export default async function SocialTagFeedPage({ params }: Args) {
  const { locale: localeParam, tag: tagParam } = await params
  if (!isValidLocaleCode(localeParam)) notFound()
  const locale = requireContentLocale(localeParam)
  setRequestLocale(locale)

  const tag = normalizeTag(decodeURIComponent(tagParam ?? ''))
  if (!tag) notFound()

  const [settings, viewer] = await Promise.all([getSiteSettings(), getAccessViewer()])
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.social)) notFound()

  const pack = await loadSocialModuleSettings()
  const tabFlags = {
    showFollowing: pack.settings.allowFollowingTab,
    showDiscover: pack.settings.allowDiscover,
    showWatch: pack.settings.allowShortVideoLayout,
    showStories: pack.settings.allowStories,
  }

  const viewerUserId = viewer.userId?.trim() || null
  const posts = await listTagFeedPosts(viewerUserId, tag)
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
      <FeedTabs locale={locale} active="feed" {...tabFlags} />
      <div className="sf-social-feed-column">
        <p className="sf-social-tag-heading">#{tag}</p>
        <FeedPostList
          items={items}
          locale={locale}
          emptyMessage={`No visible posts for #${tag}.`}
          showShare={pack.settings.allowShare}
          showSave={Boolean(viewerUserId)}
        />
      </div>
    </div>
  )
}
