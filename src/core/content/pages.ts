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
 * Uses the published-content cache (Next.js tags locally; Redis-ready later).
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
