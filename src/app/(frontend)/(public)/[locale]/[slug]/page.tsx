import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import React from 'react'

import { RichText } from '@/components/RichText'
import { PageByline } from '@/core/content/PageByline'
import { buildPageMetadata } from '@/core/content/metadata'
import { getPublishedPageBySlug, requireContentLocale } from '@/core/content/pages'
import { isValidLocaleCode, redirect } from '@/core/i18n'
import { findNavOverridesForPath } from '@/core/nav'
import { resolveSiteRoot, rootPageSlug } from '@/core/nav/root'
import { barePathForSlug } from '@/core/nav/root-target'
import { HOME_PAGE_KEY } from '@/core/page-settings'
import { getSiteSettings } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'

async function slugOwnsLocaleRoot(slug: string): Promise<boolean> {
  const root = await resolveSiteRoot()
  if (!root) return slug === HOME_PAGE_KEY
  return root.kind === 'page' && root.slug === slug
}

type Args = {
  params: Promise<{
    locale: string
    slug: string
  }>
}

/**
 * Anonymous public CMS page — published-only via cached `getPublishedPageBySlug`.
 * Draft preview lives at `/[locale]/preview/[slug]` (uncached + auth-gated).
 * Nav manager browser-title / page-heading overrides apply when the path matches.
 */
export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { locale: localeParam, slug } = await params
  if (!isValidLocaleCode(localeParam)) {
    return { title: 'Not found' }
  }
  const locale = requireContentLocale(localeParam)
  const decoded = decodeURIComponent(slug)
  const page = await getPublishedPageBySlug(decoded, locale)

  if (!page) {
    const [settings, chrome] = await Promise.all([getSiteSettings(), getSiteChrome()])
    const siteName = chrome.siteName || settings.siteName
    return {
      title: `Not found — ${siteName}`,
    }
  }

  const settings = await getSiteSettings()
  const bare = barePathForSlug(decoded, await rootPageSlug())
  const overrides = findNavOverridesForPath(settings.primaryNav, bare)
  const meta = await buildPageMetadata(page, { barePath: bare })
  if (overrides?.browserTitle) {
    return { ...meta, title: overrides.browserTitle }
  }
  return meta
}

export default async function PublicCmsPage({ params }: Args) {
  const { locale: localeParam, slug } = await params
  if (!isValidLocaleCode(localeParam)) {
    notFound()
  }
  const locale = requireContentLocale(localeParam)
  setRequestLocale(locale)

  const decodedSlug = decodeURIComponent(slug)
  if (await slugOwnsLocaleRoot(decodedSlug)) {
    redirect({ href: '/', locale })
  }
  const page = await getPublishedPageBySlug(decodedSlug, locale)

  if (!page) {
    notFound()
  }

  const settings = await getSiteSettings()
  const bare = barePathForSlug(decodedSlug, await rootPageSlug())
  const overrides = findNavOverridesForPath(settings.primaryNav, bare)
  const heading = overrides?.pageHeading?.trim() || page.title
  const t = await getTranslations({ locale, namespace: 'Page' })

  return (
    <article className="cms-page">
      <header className="cms-page-header">
        <h1>{heading}</h1>
        <PageByline
          locale={locale}
          page={page}
          t={(key, values) => t(key, values)}
        />
      </header>
      {page.body ? <RichText data={page.body} /> : <p className="lede">This page has no body yet.</p>}
    </article>
  )
}
