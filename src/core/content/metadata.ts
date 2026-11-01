import type { Metadata } from 'next'

import type { Media, Page } from '@/payload-types'

const DEFAULT_SITE_NAME = 'Starforge'

/** Public site origin (no trailing slash) for absolute asset / OG URLs. */
export function appOrigin(): string {
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

  return absoluteAssetUrl(media.url)
}

/**
 * Absolute URL for a site-relative path or pass-through for http(s).
 * Empty / whitespace → undefined.
 */
export function absoluteAssetUrl(url: string | null | undefined): string | undefined {
  const raw = typeof url === 'string' ? url.trim() : ''
  if (!raw) return undefined
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
  return `${appOrigin()}${raw.startsWith('/') ? '' : '/'}${raw}`
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

export type SiteChromeSeoDefaults = {
  siteName?: string | null
  defaultDescription?: string | null
  defaultOgImage?: string | null
}

async function loadChromeSeoDefaults(): Promise<SiteChromeSeoDefaults> {
  try {
    const { getSiteChrome } = await import('@/core/site-chrome')
    const chrome = await getSiteChrome()
    return {
      siteName: chrome.siteName,
      defaultDescription: chrome.defaultDescription,
      defaultOgImage: chrome.defaultOgImage,
    }
  } catch {
    return {}
  }
}

/**
 * Next.js Metadata for a CMS page (title, description, Open Graph, Twitter).
 * Empty page SEO fields fall back to Site Chrome defaults.
 */
export async function buildPageMetadata(page: Page): Promise<Metadata> {
  const chrome = await loadChromeSeoDefaults()
  const siteName = chrome.siteName?.trim() || DEFAULT_SITE_NAME

  const pageMetaTitle = page.meta?.title?.trim()
  const title = pageMetaTitle || `${page.title} — ${siteName}`

  const description =
    page.meta?.description?.trim() || chrome.defaultDescription?.trim() || undefined

  const pageOg = absoluteMediaUrl(resolveOgImage(page))
  const chromeOg = absoluteAssetUrl(chrome.defaultOgImage)
  const ogImageUrl = pageOg || chromeOg
  const ogAlt = resolveOgImage(page)?.alt || page.title

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName,
      ...(ogImageUrl
        ? {
            images: [
              {
                url: ogImageUrl,
                alt: ogAlt,
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
