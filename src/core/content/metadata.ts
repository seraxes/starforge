import type { Metadata } from 'next'

import type { Media, Page } from '@/payload-types'

const DEFAULT_SITE_NAME = 'Starforge'

function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '')
}

/** Turn a Payload media `url` (or absolute URL) into an absolute public URL. */
export function absoluteMediaUrl(media: Media | null | undefined): string | undefined {
  if (!media?.url) {
    return undefined
  }

  if (media.url.startsWith('http://') || media.url.startsWith('https://')) {
    return media.url
  }

  return `${appOrigin()}${media.url.startsWith('/') ? '' : '/'}${media.url}`
}

function resolveOgImage(page: Page): Media | null {
  const image = page.meta?.image
  if (!image) {
    return null
  }
  if (typeof image === 'object') {
    return image
  }
  return null
}

/**
 * Next.js Metadata for a published CMS page (title, description, Open Graph).
 */
export function buildPageMetadata(page: Page): Metadata {
  const title = page.meta?.title?.trim() || `${page.title} — ${DEFAULT_SITE_NAME}`
  const description = page.meta?.description?.trim() || undefined
  const ogImageUrl = absoluteMediaUrl(resolveOgImage(page))

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      ...(ogImageUrl
        ? {
            images: [
              {
                url: ogImageUrl,
                alt: resolveOgImage(page)?.alt || page.title,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: ogImageUrl ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(ogImageUrl ? { images: [ogImageUrl] } : {}),
    },
  }
}
