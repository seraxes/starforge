import type { LayoutSlotConfig } from '../types'

/** Logo / Image particle settings (typed — not Custom HTML). */
export type LogoParticleConfig = {
  /** Payload Media document id when known. */
  mediaId?: string
  /** Direct image URL (placeholder until a media picker lands). */
  mediaUrl?: string
  alt?: string
  maxWidth?: number
  maxHeight?: number
  /** Optional wrap link (e.g. home). */
  linkUrl?: string
}

/** Copyright particle settings. */
export type CopyrightParticleConfig = {
  text?: string
  /** `auto` = current calendar year; `manual` = `year` field. */
  yearMode?: 'auto' | 'manual'
  year?: number
  linkUrl?: string
  linkLabel?: string
}

/** One social link row. */
export type SocialLinkItem = {
  id: string
  platform: string
  url: string
  label?: string
  /** Optional icon hint (emoji, class name, or short key). */
  icon?: string
}

/** Social particle settings. */
export type SocialParticleConfig = {
  items?: SocialLinkItem[]
}

export function defaultLogoConfig(): LogoParticleConfig {
  return {
    mediaId: '',
    mediaUrl: '',
    alt: 'Logo',
    maxWidth: 180,
    maxHeight: 64,
    linkUrl: '/',
  }
}

export function defaultCopyrightConfig(): CopyrightParticleConfig {
  return {
    text: 'All rights reserved.',
    yearMode: 'auto',
    year: new Date().getFullYear(),
    linkUrl: '',
    linkLabel: '',
  }
}

export function defaultSocialConfig(): SocialParticleConfig {
  return {
    items: [
      {
        id: 'social-x',
        platform: 'X',
        url: 'https://x.com/',
        label: 'X',
        icon: '',
      },
    ],
  }
}

export function defaultConfigForModule(moduleId: string): LayoutSlotConfig | undefined {
  switch (moduleId) {
    case 'custom':
      return {
        title: 'Custom',
        html: '<p>Custom HTML</p>',
        css: '',
        js: '',
      }
    case 'logo':
      return { ...defaultLogoConfig() }
    case 'copyright':
      return { ...defaultCopyrightConfig() }
    case 'social':
      return { ...defaultSocialConfig() }
    default:
      return undefined
  }
}

export function readLogoConfig(config: LayoutSlotConfig | undefined): LogoParticleConfig {
  const c = config ?? {}
  const maxWidth = Number(c.maxWidth)
  const maxHeight = Number(c.maxHeight)
  return {
    mediaId: typeof c.mediaId === 'string' ? c.mediaId : '',
    mediaUrl: typeof c.mediaUrl === 'string' ? c.mediaUrl : '',
    alt: typeof c.alt === 'string' ? c.alt : 'Logo',
    maxWidth: Number.isFinite(maxWidth) && maxWidth > 0 ? Math.round(maxWidth) : undefined,
    maxHeight: Number.isFinite(maxHeight) && maxHeight > 0 ? Math.round(maxHeight) : undefined,
    linkUrl: typeof c.linkUrl === 'string' ? c.linkUrl : '',
  }
}

export function readCopyrightConfig(config: LayoutSlotConfig | undefined): CopyrightParticleConfig {
  const c = config ?? {}
  const year = Number(c.year)
  return {
    text: typeof c.text === 'string' ? c.text : 'All rights reserved.',
    yearMode: c.yearMode === 'manual' ? 'manual' : 'auto',
    year: Number.isFinite(year) ? Math.round(year) : new Date().getFullYear(),
    linkUrl: typeof c.linkUrl === 'string' ? c.linkUrl : '',
    linkLabel: typeof c.linkLabel === 'string' ? c.linkLabel : '',
  }
}

export function readSocialConfig(config: LayoutSlotConfig | undefined): SocialParticleConfig {
  const raw = config?.items
  if (!Array.isArray(raw)) return { items: [] }
  const items: SocialLinkItem[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const row = entry as Record<string, unknown>
    const url = typeof row.url === 'string' ? row.url.trim() : ''
    const platform = typeof row.platform === 'string' ? row.platform.trim() : ''
    if (!url && !platform) continue
    items.push({
      id: typeof row.id === 'string' && row.id ? row.id : `social-${items.length + 1}`,
      platform: platform || 'Link',
      url: url || '#',
      label: typeof row.label === 'string' ? row.label : '',
      icon: typeof row.icon === 'string' ? row.icon : '',
    })
  }
  return { items }
}
