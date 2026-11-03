import { getPayload } from 'payload'
import { cache } from 'react'

import config from '@payload-config'
import type { Page } from '@/payload-types'

import { contentCacheTags, getPublishedContentCache } from './cache'

async function loadPublishedPageUncached(slug: string): Promise<Page | null> {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'pages',
    depth: 2,
    draft: false,
    limit: 1,
    overrideAccess: false,
    pagination: false,
    where: {
      and: [
        {
          slug: {
            equals: slug,
          },
        },
        {
          _status: {
            equals: 'published',
          },
        },
      ],
    },
  })

  return result.docs[0] ?? null
}

/**
 * Load a published CMS page by slug for the public site.
 *
 * Uses the published-content cache (Next.js tags locally; Redis when selected).
 * Drafts are never returned here (Payload access + draft: false).
 * For preview, use `getDraftPageBySlug` (uncached + auth-gated).
 */
export const getPublishedPageBySlug = cache(async (slug: string): Promise<Page | null> => {
  return getPublishedContentCache().getCached(
    {
      key: ['sf', 'published-page', slug],
      tags: [contentCacheTags.pages, contentCacheTags.page(slug)],
      revalidate: false,
    },
    () => loadPublishedPageUncached(slug),
  )
})

/**
 * Load the latest draft (or published) version of a page by slug.
 *
 * Used only by `/preview/[slug]` after core auth + feature-flag checks.
 * Intentionally **not** cached — editors must see the latest draft.
 * `overrideAccess: true` is intentional — the public route has a Better Auth
 * session, not a Payload `req.user`, so collection access would otherwise hide drafts.
 */
export const getDraftPageBySlug = cache(async (slug: string): Promise<Page | null> => {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'pages',
    depth: 2,
    draft: true,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    where: {
      slug: {
        equals: slug,
      },
    },
  })

  return result.docs[0] ?? null
})

export type PublishedPageSitemapEntry = {
  slug: string
  updatedAt: string | null
}

async function loadPublishedPageSitemapEntriesUncached(): Promise<PublishedPageSitemapEntry[]> {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'pages',
    depth: 0,
    draft: false,
    limit: 1000,
    overrideAccess: false,
    pagination: false,
    where: {
      _status: {
        equals: 'published',
      },
    },
    select: {
      slug: true,
      updatedAt: true,
    },
  })

  const out: PublishedPageSitemapEntry[] = []
  for (const doc of result.docs) {
    const slug = typeof doc.slug === 'string' ? doc.slug.trim() : ''
    if (!slug) continue
    const rawUpdated = (doc as { updatedAt?: unknown }).updatedAt
    let updatedAt: string | null = null
    if (typeof rawUpdated === 'string') {
      updatedAt = rawUpdated
    } else if (rawUpdated instanceof Date) {
      updatedAt = rawUpdated.toISOString()
    }
    out.push({ slug, updatedAt })
  }
  return out
}

/**
 * List published page slugs (+ updatedAt) for sitemap.xml.
 * Cached under the same published-pages tag as single-page reads.
 */
export const listPublishedPageSitemapEntries = cache(
  async (): Promise<PublishedPageSitemapEntry[]> => {
    return getPublishedContentCache().getCached(
      {
        key: ['sf', 'published-pages-sitemap'],
        tags: [contentCacheTags.pages],
        revalidate: false,
      },
      loadPublishedPageSitemapEntriesUncached,
    )
  },
)
