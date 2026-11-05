import React from 'react'

import { Link } from '@/core/i18n/navigation'
import { resolveMediaBind } from '@/core/media/resolve'
import { isExternalHref } from '@/core/settings/nav'

import { parseCssColorInput } from '../styles'
import type { StarforgeModule } from '../types'
import { readLogoConfig } from './config'

function LogoLink({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: React.ReactNode
}) {
  if (isExternalHref(href)) {
    return (
      <a href={href} className={className} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    )
  }
  return (
    <Link href={href || '/'} className={className}>
      {children}
    </Link>
  )
}

async function resolveLogoSrc(mediaId: string, mediaUrl: string, alt: string) {
  const resolved = await resolveMediaBind({
    mediaId,
    mediaUrl,
    alt,
    preferWebp: false,
  })
  if (!resolved) return { src: '', alt }
  return { src: resolved.src, alt: resolved.alt }
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
    'Image (library Media id, URL fallback) or text logo (font, size, weight, color). Prefer with Menu particle instead of Site Header brand text.',
  builtin: true,
  defaultWidth: 25,
  render: async ({ slot }) => {
    const cfg = readLogoConfig(slot.config)
    const href = (cfg.linkUrl ?? '').trim()

    if (cfg.mode === 'text') {
      let label = (cfg.text ?? '').trim()
      if (!label) label = await resolveTextLogoFallback()
      const colorParsed = parseCssColorInput(cfg.color ?? '')
      const style: React.CSSProperties = {
        fontFamily: (cfg.fontFamily ?? '').trim() || undefined,
        fontSize: cfg.fontSize ? `${cfg.fontSize}px` : undefined,
        fontWeight: cfg.fontWeight ?? 700,
        color: colorParsed.status === 'ok' ? colorParsed.value : undefined,
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
            <LogoLink href={href} className="sf-logo-link">
              {textEl}
            </LogoLink>
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
        <small>Choose Media from the library, or switch to Text logo mode</small>
      </div>
    )

    return (
      <div className="sf-logo sf-logo-mode-image" data-sf-particle="logo" data-sf-slot={slot.id}>
        {href ? (
          <LogoLink href={href} className="sf-logo-link">
            {image}
          </LogoLink>
        ) : (
          image
        )}
      </div>
    )
  },
}
