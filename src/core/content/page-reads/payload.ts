/**
 * Payload adapter for PageReadsPort.
 * Sole `getPayload()` caller for the four layout-host page reads.
 */

import 'server-only'

import { getPayload } from 'payload'
import type { Where } from 'payload'

import config from '@payload-config'
import type { Page } from '@/payload-types'

import { DEFAULT_LOCALE, type AppLocale, toPayloadLocale } from '@/core/i18n/locales'

import type {
  PageReadsPort,
  PageReadsPublishedSummary,
  PageReadsSearchResult,
} from './types'

export function createPayloadPageReads(): PageReadsPort {
  return {
    async findPublishedBySlug(slug, locale) {
      const payload = await getPayload({ config })
      const payloadLocale = toPayloadLocale(locale)

      const result = await payload.find({
        collection: 'pages',
        depth: 2,
        draft: false,
        limit: 1,
        locale: payloadLocale,
        fallbackLocale: DEFAULT_LOCALE,
        overrideAccess: false,
        pagination: false,
        where: {
          and: [
            { slug: { equals: slug } },
            { _status: { equals: 'published' } },
          ],
        },
      })

      return (result.docs[0] as Page | undefined) ?? null
    },

    async findDraftBySlug(slug, locale) {
      const payload = await getPayload({ config })
      const payloadLocale = toPayloadLocale(locale)

      const result = await payload.find({
        collection: 'pages',
        depth: 2,
        draft: true,
        limit: 1,
        locale: payloadLocale,
        fallbackLocale: DEFAULT_LOCALE,
        overrideAccess: true,
        pagination: false,
        where: {
          slug: { equals: slug },
        },
      })

      return (result.docs[0] as Page | undefined) ?? null
    },

    async searchPublished(query, locale, options): Promise<PageReadsSearchResult> {
      const payload = await getPayload({ config })
      const where: Where = {
        and: [
          { _status: { equals: 'published' } },
          {
            or: [
              { title: { contains: query } },
              { slug: { contains: query } },
              { 'meta.title': { contains: query } },
              { 'meta.description': { contains: query } },
            ],
          },
        ],
      }

      const payloadLocale = toPayloadLocale(locale)
      const result = await payload.find({
        collection: 'pages',
        depth: 0,
        draft: false,
        limit: options.limit,
        locale: payloadLocale,
        fallbackLocale: DEFAULT_LOCALE,
        pagination: true,
        overrideAccess: false,
        sort: 'title',
        where,
        select: {
          title: true,
          slug: true,
          meta: true,
        },
      })

      return {
        docs: result.docs.map((doc) => ({
          id: doc.id,
          title: typeof doc.title === 'string' ? doc.title : null,
          slug: typeof doc.slug === 'string' ? doc.slug : null,
          meta:
            doc.meta && typeof doc.meta === 'object'
              ? {
                  title:
                    typeof doc.meta.title === 'string' ? doc.meta.title : null,
                  description:
                    typeof doc.meta.description === 'string'
                      ? doc.meta.description
                      : null,
                }
              : null,
        })),
        totalDocs:
          typeof result.totalDocs === 'number' ? result.totalDocs : result.docs.length,
      }
    },

    async listPublishedSummaries(): Promise<PageReadsPublishedSummary[]> {
      const payload = await getPayload({ config })
      const result = await payload.find({
        collection: 'pages',
        depth: 0,
        draft: false,
        limit: 1000,
        pagination: false,
        overrideAccess: false,
        // Slug is not localized — any locale returns the same slug set; use default.
        locale: DEFAULT_LOCALE,
        fallbackLocale: DEFAULT_LOCALE,
        sort: 'slug',
        where: {
          _status: { equals: 'published' },
        },
        select: {
          slug: true,
          updatedAt: true,
        },
      })

      const out: PageReadsPublishedSummary[] = []
      for (const doc of result.docs) {
        if (typeof doc.id !== 'number') continue
        const slug = typeof doc.slug === 'string' ? doc.slug.trim() : ''
        if (!slug) continue
        const updatedAt =
          typeof doc.updatedAt === 'string' && doc.updatedAt
            ? doc.updatedAt
            : new Date().toISOString()
        out.push({ id: doc.id, slug, updatedAt })
      }
      return out
    },
  }
}
