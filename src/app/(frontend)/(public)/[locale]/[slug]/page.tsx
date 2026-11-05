import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import React from 'react'

import { RichText } from '@/components/RichText'
import { buildPageMetadata } from '@/core/content/metadata'
import { getPublishedPageBySlug, requireContentLocale } from '@/core/content/pages'
import { routing } from '@/core/i18n'
import { findNavOverridesForPath } from '@/core/nav'
import { getSiteSettings } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'

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
  if (!hasLocale(routing.locales, localeParam)) {
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
  const overrides = findNavOverridesForPath(settings.primaryNav, `/${decoded}`)
  const meta = await buildPageMetadata(page)
  if (overrides?.browserTitle) {
    return { ...meta, title: overrides.browserTitle }
  }
  return meta
}

export default async function PublicCmsPage({ params }: Args) {
  const { locale: localeParam, slug } = await params
  if (!hasLocale(routing.locales, localeParam)) {
    notFound()
  }
  const locale = requireContentLocale(localeParam)
  setRequestLocale(locale)

  const decodedSlug = decodeURIComponent(slug)
  const page = await getPublishedPageBySlug(decodedSlug, locale)

  if (!page) {
    notFound()
  }

  const settings = await getSiteSettings()
  const overrides = findNavOverridesForPath(settings.primaryNav, `/${decodedSlug}`)
  const heading = overrides?.pageHeading?.trim() || page.title

  return (
    <article className="cms-page">
      <header className="cms-page-header">
        <h1>{heading}</h1>
      </header>
      {page.body ? <RichText data={page.body} /> : <p className="lede">This page has no body yet.</p>}
    </article>
  )
}
