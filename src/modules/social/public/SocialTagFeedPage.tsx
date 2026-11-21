import type { Metadata } from 'next'
import Link from 'next/link'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import React from 'react'

import { getAccessViewer } from '@/core/acl/access'
import { requireContentLocale } from '@/core/content/pages'
import { isValidLocaleCode } from '@/core/i18n'
import { withLocalePrefix } from '@/core/i18n/path'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'
import { getPersonas } from '@/modules/profiles/api.server'

import { listTagFeedPosts } from '../mentions-tags-saves-store'
import { normalizeTag } from '../mentions-tags-saves'
import { FeedPostList } from './FeedPostList'

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
    <article className="cms-page sf-social-feed-page">
      <header className="cms-page-header">
        <h1>#{tag}</h1>
        <p className="lede">
          <Link href={withLocalePrefix('/feed', locale)}>Back to feed</Link>
        </p>
      </header>
      <FeedPostList
        items={items}
        locale={locale}
        emptyMessage={`No visible posts for #${tag}.`}
        showShare
        showSave={Boolean(viewerUserId)}
      />
    </article>
  )
}
