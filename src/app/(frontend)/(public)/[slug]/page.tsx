import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import { RichText } from '@/components/RichText'
import { buildPageMetadata } from '@/core/content/metadata'
import { getPublishedPageBySlug } from '@/core/content/pages'
import { findNavOverridesForPath } from '@/core/nav'
import { getSiteSettings } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'

type Args = {
  params: Promise<{
    slug: string
  }>
}

/**
 * Anonymous public CMS page — published-only via cached `getPublishedPageBySlug`.
 * Draft preview lives at `/preview/[slug]` (uncached + auth-gated).
 * Nav manager browser-title / page-heading overrides apply when the path matches.
 */
export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params
  const decoded = decodeURIComponent(slug)
  const page = await getPublishedPageBySlug(decoded)

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
  const { slug } = await params
  const decodedSlug = decodeURIComponent(slug)
  const page = await getPublishedPageBySlug(decodedSlug)

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
