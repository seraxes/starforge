import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { RichText } from '@/components/RichText'
import { PageByline } from '@/core/content/PageByline'
import { buildPageMetadata } from '@/core/content/metadata'
import { getDraftPageBySlug, requireContentLocale } from '@/core/content/pages'
import {
  requireDraftPreviewAccess,
  resolveDraftPreviewAccess,
} from '@/core/content/preview'
import { isValidLocaleCode } from '@/core/i18n'
import { withLocalePrefix } from '@/core/i18n/path'
import { rootPageSlug } from '@/core/nav/root'
import { barePathForSlug } from '@/core/nav/root-target'
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

  if (!isValidLocaleCode(localeParam)) {
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
  if (!isValidLocaleCode(localeParam)) {
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

  const status =
    page._status === 'published'
      ? 'published'
      : page._status === 'unpublished'
        ? 'unpublished'
        : 'draft'
  const t = await getTranslations({ locale, namespace: 'Page' })
  const publicHref = withLocalePrefix(
    barePathForSlug(page.slug, await rootPageSlug()),
    locale,
  )
  const rawId = typeof page.id === 'string' ? page.id.trim() : ''
  const editHref = rawId ? `/admin/pages/${rawId}` : '/admin/pages'

  return (
    <article className="cms-page cms-page-preview">
      <div className="preview-banner" role="status">
        <p>
          <strong>Draft preview</strong>
          {status === 'published' ? null : (
            <> — this page is <em>{status === 'unpublished' ? 'unpublished' : 'a draft'}</em>. Anonymous visitors still get 404 at{' '}
              <code>{publicHref}</code>.</>
          )}
          {status === 'published' ? (
            <>
              {' '}
              — showing the latest version (including unsaved draft changes when present). Public
              URL: <Link href={publicHref}>{publicHref}</Link>.
            </>
          ) : null}
        </p>
        <p className="preview-banner-actions">
          <Link href={editHref}>Edit page</Link>
          {' · '}
          <Link href="/admin/settings">Feature toggles</Link>
        </p>
      </div>
      <header className="cms-page-header">
        <h1>{page.title}</h1>
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
