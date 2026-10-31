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

/**
 * Typed Logo / Image particle — Payload Media id or URL, alt, optional max size.
 */
export const logoModule: StarforgeModule = {
  id: 'logo',
  name: 'Logo / Image',
  description: 'Image from Media id or URL, with alt and optional max size.',
  builtin: true,
  defaultWidth: 25,
  render: async ({ slot }) => {
    const cfg = readLogoConfig(slot.config)
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
        <small>Set Media id or URL in the layout editor</small>
      </div>
    )

    const href = (cfg.linkUrl ?? '').trim()
    return (
      <div className="sf-logo" data-sf-particle="logo" data-sf-slot={slot.id}>
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
