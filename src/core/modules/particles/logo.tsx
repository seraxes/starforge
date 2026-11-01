import React from 'react'
import Link from 'next/link'
import { getPayload } from 'payload'

import config from '@payload-config'
import { absoluteMediaUrl } from '@/core/content/metadata'
import type { Media } from '@/payload-types'

import type { StarforgeModule } from '../types'
import { readLogoConfig } from './config'

async function resolveLogoSrc(mediaId: string, mediaUrl: string, alt: string) {
  if (mediaUrl.trim()) {
    return { src: mediaUrl.trim(), alt }
  }
  if (!mediaId.trim()) {
    return { src: '', alt }
  }
  try {
    const payload = await getPayload({ config })
    const doc = (await payload.findByID({
      collection: 'media',
      id: mediaId.trim(),
      depth: 0,
      overrideAccess: true,
    })) as Media
    const src = absoluteMediaUrl(doc) || ''
    return { src, alt: alt.trim() || doc.alt || 'Logo' }
  } catch {
    return { src: '', alt }
  }
}

async function resolveTextLogoFallback(): Promise<string> {
  try {
    const { getSiteChrome } = await import('@/core/site-chrome')
    const chrome = await getSiteChrome()
    if (chrome.siteName.trim()) return chrome.siteName.trim()
  } catch {
    // ignore
  }
  return 'Starforge'
}

/**
 * Typed Logo / Image particle — image (Media/URL) or styled text logo.
 * Text mode replaces site-header brand when used with the Menu particle.
 */
export const logoModule: StarforgeModule = {
  id: 'logo',
  name: 'Logo / Image',
  description:
    'Image (Media id/URL) or text logo (font, size, weight, color). Prefer with Menu particle instead of Site Header brand text.',
  builtin: true,
  defaultWidth: 25,
  render: async ({ slot }) => {
    const cfg = readLogoConfig(slot.config)
    const href = (cfg.linkUrl ?? '').trim()

    if (cfg.mode === 'text') {
      let label = (cfg.text ?? '').trim()
      if (!label) label = await resolveTextLogoFallback()
      const style: React.CSSProperties = {
        fontFamily: (cfg.fontFamily ?? '').trim() || undefined,
        fontSize: cfg.fontSize ? `${cfg.fontSize}px` : undefined,
        fontWeight: cfg.fontWeight ?? 700,
        color: (cfg.color ?? '').trim() || undefined,
        lineHeight: 1.15,
        margin: 0,
      }
      const textEl = (
        <span className="sf-logo-text" style={style}>
          {label}
        </span>
      )
      return (
        <div className="sf-logo sf-logo-mode-text" data-sf-particle="logo" data-sf-slot={slot.id}>
          {href ? (
            <Link href={href} className="sf-logo-link">
              {textEl}
            </Link>
          ) : (
            textEl
          )}
        </div>
      )
    }

    const { src, alt } = await resolveLogoSrc(cfg.mediaId ?? '', cfg.mediaUrl ?? '', cfg.alt ?? 'Logo')
    const style: React.CSSProperties = {
      maxWidth: cfg.maxWidth ? `${cfg.maxWidth}px` : undefined,
      maxHeight: cfg.maxHeight ? `${cfg.maxHeight}px` : undefined,
      width: 'auto',
      height: 'auto',
      display: 'block',
    }

    const image = src ? (
      // eslint-disable-next-line @next/next/no-img-element -- layout particle; URL may be external or Payload
      <img className="sf-logo-img" src={src} alt={alt} style={style} />
    ) : (
      <div className="sf-logo-placeholder" role="img" aria-label={alt || 'Logo placeholder'}>
        <span>Logo / Image</span>
        <small>Set Media id or URL, or switch to Text logo mode</small>
      </div>
    )

    return (
      <div className="sf-logo sf-logo-mode-image" data-sf-particle="logo" data-sf-slot={slot.id}>
        {href ? (
          <Link href={href} className="sf-logo-link">
            {image}
          </Link>
        ) : (
          image
        )}
      </div>
    )
  },
}
