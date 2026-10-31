import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { RichText } from '@/components/RichText'
import { buildPageMetadata } from '@/core/content/metadata'
import { getDraftPageBySlug } from '@/core/content/pages'
import {
  requireDraftPreviewAccess,
  resolveDraftPreviewAccess,
} from '@/core/content/preview'
import { getSiteSettings } from '@/core/settings'

type Args = {
  params: Promise<{
    slug: string
  }>
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params
  const decodedSlug = decodeURIComponent(slug)
  const settings = await getSiteSettings()
  const robots = { index: false, follow: false } as const

  // Same capability check as the page body — never leak draft titles otherwise.
  const gate = await resolveDraftPreviewAccess()
  if (!gate.ok) {
    return { title: `Preview — ${settings.siteName}`, robots }
  }

  const page = await getDraftPageBySlug(decodedSlug)
  if (!page) {
    return { title: `Not found — ${settings.siteName}`, robots }
  }

  const meta = buildPageMetadata(page)
  return {
    ...meta,
    title: `Preview: ${page.title} — ${settings.siteName}`,
    robots,
  }
}

/**
 * Draft preview — CMS-capable users only (`cms_access` + feature toggle).
 * Anonymous / public `/[slug]` remains published-only.
 */
export default async function DraftPreviewPage({ params }: Args) {
  const { slug } = await params
  const decodedSlug = decodeURIComponent(slug)
  const returnPath = `/preview/${encodeURIComponent(decodedSlug)}`

  await requireDraftPreviewAccess(returnPath)

  const page = await getDraftPageBySlug(decodedSlug)
  if (!page) {
    notFound()
  }

  const status = page._status === 'published' ? 'published' : 'draft'
  const publicHref = `/${page.slug}`

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
          <Link href="/admin/collections/pages">Edit in Payload</Link>
          {' · '}
          <Link href="/app/admin/settings">Feature toggles</Link>
        </p>
      </div>
      <header className="cms-page-header">
        <h1>{page.title}</h1>
      </header>
      {page.body ? <RichText data={page.body} /> : <p className="lede">This page has no body yet.</p>}
    </article>
  )
}
