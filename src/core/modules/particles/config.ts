import { defaultFormConfig } from '@/core/forms/config'

import type { LayoutSlotConfig } from '../types'

export type LogoParticleMode = 'image' | 'text'

/** Logo / Image particle settings (typed — not Custom HTML). */
export type LogoParticleConfig = {
  /** `image` = Media/URL; `text` = styled text logo (replaces site-header brand). */
  mode?: LogoParticleMode
  /** Payload Media document id when known. */
  mediaId?: string
  /** Direct image URL (placeholder until a media picker lands). */
  mediaUrl?: string
  alt?: string
  maxWidth?: number
  maxHeight?: number
  /** Optional wrap link (e.g. home). */
  linkUrl?: string
  /** Text-logo fields (when mode === 'text'). */
  text?: string
  fontFamily?: string
  fontSize?: number
  fontWeight?: number | string
  color?: string
}

/** Menu particle — binds to a Nav manager menu set. */
export type MenuParticleConfig = {
  /**
   * Nav menu id (`sf_nav_menus`). Empty / `primary` = site primary
   * (`settings.primaryNavMenuId` / default Main).
   */
  menuId?: string
  /** Optional aria-label for the nav landmark. */
  ariaLabel?: string
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
    mode: 'image',
    mediaId: '',
    mediaUrl: '',
    alt: 'Logo',
    maxWidth: 180,
    maxHeight: 64,
    linkUrl: '/',
    text: 'Starforge',
    fontFamily: '',
    fontSize: 28,
    fontWeight: 700,
    color: '',
  }
}

export function defaultMenuConfig(): MenuParticleConfig {
  return {
    menuId: '',
    ariaLabel: 'Primary',
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
    case 'menu':
      return { ...defaultMenuConfig() }
    case 'copyright':
      return { ...defaultCopyrightConfig() }
    case 'social':
      return { ...defaultSocialConfig() }
    case 'form':
      return { ...defaultFormConfig() }
    default:
      return undefined
  }
}

export function readLogoConfig(config: LayoutSlotConfig | undefined): LogoParticleConfig {
  const c = config ?? {}
  const maxWidth = Number(c.maxWidth)
  const maxHeight = Number(c.maxHeight)
  const fontSize = Number(c.fontSize)
  const fontWeightRaw = c.fontWeight
  let fontWeight: number | string = 700
  if (typeof fontWeightRaw === 'number' && Number.isFinite(fontWeightRaw)) {
    fontWeight = Math.round(fontWeightRaw)
  } else if (typeof fontWeightRaw === 'string' && fontWeightRaw.trim()) {
    fontWeight = fontWeightRaw.trim()
  }
  return {
    mode: c.mode === 'text' ? 'text' : 'image',
    mediaId: typeof c.mediaId === 'string' ? c.mediaId : '',
    mediaUrl: typeof c.mediaUrl === 'string' ? c.mediaUrl : '',
    alt: typeof c.alt === 'string' ? c.alt : 'Logo',
    maxWidth: Number.isFinite(maxWidth) && maxWidth > 0 ? Math.round(maxWidth) : undefined,
    maxHeight: Number.isFinite(maxHeight) && maxHeight > 0 ? Math.round(maxHeight) : undefined,
    linkUrl: typeof c.linkUrl === 'string' ? c.linkUrl : '',
    text: typeof c.text === 'string' ? c.text : 'Starforge',
    fontFamily: typeof c.fontFamily === 'string' ? c.fontFamily : '',
    fontSize: Number.isFinite(fontSize) && fontSize > 0 ? Math.round(fontSize) : 28,
    fontWeight,
    color: typeof c.color === 'string' ? c.color : '',
  }
}

export function readMenuConfig(config: LayoutSlotConfig | undefined): MenuParticleConfig {
  const c = config ?? {}
  const menuId = typeof c.menuId === 'string' ? c.menuId.trim() : ''
  return {
    menuId: menuId === 'primary' ? '' : menuId,
    ariaLabel:
      typeof c.ariaLabel === 'string' && c.ariaLabel.trim() ? c.ariaLabel.trim() : 'Primary',
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
