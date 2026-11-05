import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { RichText } from '@/components/RichText'
import { buildPageMetadata } from '@/core/content/metadata'
import { getDraftPageBySlug, requireContentLocale } from '@/core/content/pages'
import {
  requireDraftPreviewAccess,
  resolveDraftPreviewAccess,
} from '@/core/content/preview'
import { routing } from '@/core/i18n'
import { withLocalePrefix } from '@/core/i18n/path'
import { getSiteSettings } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'

type Args = {
  params: Promise<{
    locale: string
    slug: string
  }>
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { locale: localeParam, slug } = await params
  const [settings, chrome] = await Promise.all([getSiteSettings(), getSiteChrome()])
  const siteName = chrome.siteName || settings.siteName
  const robots = { index: false, follow: false } as const

  if (!hasLocale(routing.locales, localeParam)) {
    return { title: `Preview — ${siteName}`, robots }
  }
  const locale = requireContentLocale(localeParam)

  // Same capability check as the page body — never leak draft titles otherwise.
  const gate = await resolveDraftPreviewAccess()
  if (!gate.ok) {
    return { title: `Preview — ${siteName}`, robots }
  }

  const decodedSlug = decodeURIComponent(slug)
  const page = await getDraftPageBySlug(decodedSlug, locale)
  if (!page) {
    return { title: `Not found — ${siteName}`, robots }
  }

  const meta = await buildPageMetadata(page)
  return {
    ...meta,
    title: `Preview: ${page.title} — ${siteName}`,
    robots,
  }
}

/**
 * Draft preview — CMS-capable users only (`cms_access` + feature toggle).
 * Anonymous / public `/[locale]/[slug]` remains published-only.
 */
export default async function DraftPreviewPage({ params }: Args) {
  const { locale: localeParam, slug } = await params
  if (!hasLocale(routing.locales, localeParam)) {
    notFound()
  }
  const locale = requireContentLocale(localeParam)
  setRequestLocale(locale)

  const decodedSlug = decodeURIComponent(slug)
  const returnPath = withLocalePrefix(
    `/preview/${encodeURIComponent(decodedSlug)}`,
    locale,
  )

  await requireDraftPreviewAccess(returnPath)

  const page = await getDraftPageBySlug(decodedSlug, locale)
  if (!page) {
    notFound()
  }

  const status = page._status === 'published' ? 'published' : 'draft'
  const publicHref = withLocalePrefix(
    page.slug === 'home' ? '/' : `/${page.slug}`,
    locale,
  )

  return (
    <article className="cms-page cms-page-preview">
      <div className="preview-banner" role="status">
        <p>
          <strong>Draft preview</strong>
          {status === 'draft' ? (
            <> — this page is <em>unpublished</em>. Anonymous visitors still get 404 at{' '}
              <code>{publicHref}</code>.</>
          ) : (
            <> — showing the latest version (including unsaved draft changes when present). Public URL:{' '}
              <Link href={publicHref}>{publicHref}</Link>.</>
          )}
        </p>
        <p className="preview-banner-actions">
          <Link href="/cms/admin/collections/pages">Edit in Payload</Link>
          {' · '}
          <Link href="/admin/settings">Feature toggles</Link>
        </p>
      </div>
      <header className="cms-page-header">
        <h1>{page.title}</h1>
      </header>
      {page.body ? <RichText data={page.body} /> : <p className="lede">This page has no body yet.</p>}
    </article>
  )
}
