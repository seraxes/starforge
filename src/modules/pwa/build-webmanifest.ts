/**
 * Build a W3C Web App Manifest from Site Chrome + Page Settings + module settings.
 */

import 'server-only'

import { absoluteAssetUrl } from '@/core/content/metadata'
import { DEFAULT_LOCALE } from '@/core/i18n'
import { getLocalizationSettings } from '@/core/localization/store'
import { resolveMediaById } from '@/core/media/resolve'
import { getGlobalPageChrome } from '@/core/page-settings'
import { getSiteSettings } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'

import { loadPwaModuleSettings } from './settings'
import type { PwaModuleSettings } from './types'

export type WebAppManifestIcon = {
  src: string
  sizes: string
  type?: string
  purpose?: string
}

export type WebAppManifestDoc = {
  id: string
  name: string
  short_name: string
  description?: string
  start_url: string
  scope: string
  display: PwaModuleSettings['display']
  background_color: string
  theme_color: string
  icons: WebAppManifestIcon[]
}

function guessImageType(url: string): string | undefined {
  const lower = url.toLowerCase().split('?')[0] || ''
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  return undefined
}

function withLocaleStartUrl(startUrl: string, defaultLocale: string): string {
  const path = startUrl.trim() || '/'
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  if (path === '/') return `/${defaultLocale}/`
  // Already locale-prefixed or deeper path — leave as-is.
  const segments = path.replace(/^\//, '').split('/')
  if (segments[0] && segments[0].length <= 12) {
    // Heuristic: if first segment looks like a locale (en, hu, en-US), keep.
    if (/^[a-z]{2}(-[A-Za-z]{2})?$/.test(segments[0])) return path.startsWith('/') ? path : `/${path}`
  }
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `/${defaultLocale}${normalized}`
}

async function resolveIconUrl(settings: PwaModuleSettings): Promise<string | undefined> {
  if (settings.iconMediaId.trim()) {
    const media = await resolveMediaById(settings.iconMediaId.trim())
    const fromMedia = media?.absoluteUrl || absoluteAssetUrl(media?.url)
    if (fromMedia) return fromMedia
  }
  const override = absoluteAssetUrl(settings.iconUrl)
  if (override) return override

  const chrome = await getGlobalPageChrome()
  return (
    absoluteAssetUrl(chrome.touchIconUrl) ||
    absoluteAssetUrl(chrome.faviconUrl) ||
    undefined
  )
}

/** Assemble the public webmanifest payload (caller gates on module enabled). */
export async function buildWebAppManifest(): Promise<WebAppManifestDoc> {
  const [siteSettings, siteChrome, pwa, localization] = await Promise.all([
    getSiteSettings(),
    getSiteChrome(),
    loadPwaModuleSettings(),
    getLocalizationSettings(),
  ])

  const name = (siteChrome.siteName || siteSettings.siteName || 'Starforge').trim()
  const shortName = (pwa.settings.shortName || name).trim().slice(0, 32) || name.slice(0, 32)
  const defaultLocale = localization.defaultLocale || DEFAULT_LOCALE
  const startUrl = withLocaleStartUrl(pwa.settings.startUrl, defaultLocale)
  const iconSrc = await resolveIconUrl(pwa.settings)

  const icons: WebAppManifestIcon[] = []
  if (iconSrc) {
    const type = guessImageType(iconSrc)
    icons.push(
      {
        src: iconSrc,
        sizes: '192x192',
        type,
        purpose: 'any',
      },
      {
        src: iconSrc,
        sizes: '512x512',
        type,
        purpose: 'any maskable',
      },
    )
  }

  const description = siteChrome.defaultDescription?.trim() || undefined

  return {
    id: '/',
    name,
    short_name: shortName,
    description,
    start_url: startUrl,
    scope: '/',
    display: pwa.settings.display,
    background_color: pwa.settings.backgroundColor,
    theme_color: pwa.settings.themeColor,
    icons,
  }
}

export async function loadPwaThemeColor(): Promise<string | null> {
  const loaded = await loadPwaModuleSettings()
  return loaded.settings.themeColor || null
}
