import { defaultFormConfig } from '@/core/forms/config'
import { normalizeLocaleTextMap } from '@/core/i18n/locale-text'

import type { LayoutSlotConfig } from '../types'

export type LogoParticleMode = 'image' | 'text'

/** Logo / Image particle settings (typed — not Custom HTML). */
export type LogoParticleConfig = {
  /** `image` = Media library / URL fallback; `text` = styled text logo (replaces site-header brand). */
  mode?: LogoParticleMode
  /** Payload Media document id (primary bind — SF-66). */
  mediaId?: string
  /** Direct image URL fallback when no mediaId. */
  mediaUrl?: string
  alt?: string
  maxWidth?: number
  maxHeight?: number
  /** Optional wrap link (e.g. home). */
  linkUrl?: string
  /** Text-logo fields (when mode === 'text'). Default-locale text. */
  text?: string
  /** Text logo per locale. */
  textLocales?: Record<string, string>
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
  /** Copyright line per locale. */
  textLocales?: Record<string, string>
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
  /** Visible label per locale. */
  labelLocales?: Record<string, string>
  /** Optional icon hint (emoji, class name, or short key). */
  icon?: string
}

/** Social particle settings. */
export type SocialParticleConfig = {
  items?: SocialLinkItem[]
}

/** Login / welcome particle — short note + auth panel (not for branded heroes). */
export type LoginParticleConfig = {
  /** Optional override for the short welcome sentence. Default locale. */
  welcomeNote?: string
  /** Welcome sentence per locale. */
  welcomeNoteLocales?: Record<string, string>
  /** When false, show Sign in CTA + option links only (no embedded form). */
  showForm?: boolean
}

/** Locale Switcher particle — public language links (P2). */
export type LocaleSwitcherParticleConfig = {
  /** Optional aria-label for the nav landmark. */
  ariaLabel?: string
  /** `labels` = English/Magyar; `codes` = EN/HU. */
  display?: 'labels' | 'codes'
}

/** Spacer particle — empty gap (px). Width omitted → fill the column. */
export type SpacerParticleConfig = {
  /** Vertical size in CSS pixels. */
  height: number
  /** Optional horizontal size in CSS pixels; omit to span the column. */
  width?: number
}

/** Account menu avatar silhouette. */
export type AccountMenuAvatarShape = 'circle' | 'square' | 'hexagon'

/** Account menu particle — avatar chrome only (labels stay in Auth i18n). */
export type AccountMenuParticleConfig = {
  /** Avatar silhouette. Default `circle`. */
  avatarShape: AccountMenuAvatarShape
  /** Avatar edge length in CSS pixels. Default 36. */
  avatarSize: number
}

const ACCOUNT_MENU_AVATAR_SIZE_MIN = 20
const ACCOUNT_MENU_AVATAR_SIZE_MAX = 96

export function clampAccountMenuAvatarSize(raw: unknown, fallback = 36): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.max(
    ACCOUNT_MENU_AVATAR_SIZE_MIN,
    Math.min(ACCOUNT_MENU_AVATAR_SIZE_MAX, Math.round(n)),
  )
}

export function normalizeAccountMenuAvatarShape(raw: unknown): AccountMenuAvatarShape {
  if (raw === 'square' || raw === 'hexagon' || raw === 'circle') return raw
  return 'circle'
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

export function defaultLoginConfig(): LoginParticleConfig {
  return {
    welcomeNote: '',
    showForm: true,
  }
}

export function defaultLocaleSwitcherConfig(): LocaleSwitcherParticleConfig {
  return {
    ariaLabel: '',
    display: 'labels',
  }
}

export function defaultSpacerConfig(): SpacerParticleConfig {
  return {
    height: 24,
  }
}

export function defaultAccountMenuConfig(): AccountMenuParticleConfig {
  return {
    avatarShape: 'circle',
    avatarSize: 36,
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
    case 'login':
      return { ...defaultLoginConfig() }
    case 'locale-switcher':
      return { ...defaultLocaleSwitcherConfig() }
    case 'spacer':
      return { ...defaultSpacerConfig() }
    case 'account-menu':
      return { ...defaultAccountMenuConfig() }
    default:
      return undefined
  }
}

export function readLoginConfig(config: LayoutSlotConfig | undefined): LoginParticleConfig {
  const c = config ?? {}
  return {
    welcomeNote: typeof c.welcomeNote === 'string' ? c.welcomeNote : '',
    welcomeNoteLocales: normalizeLocaleTextMap(c.welcomeNoteLocales),
    showForm: c.showForm !== false,
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
    textLocales: normalizeLocaleTextMap(c.textLocales),
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
    textLocales: normalizeLocaleTextMap(c.textLocales),
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
      labelLocales: normalizeLocaleTextMap(row.labelLocales),
      icon: typeof row.icon === 'string' ? row.icon : '',
    })
  }
  return { items }
}

export function readLocaleSwitcherConfig(
  config: LayoutSlotConfig | undefined,
): LocaleSwitcherParticleConfig {
  const c = config ?? {}
  return {
    ariaLabel: typeof c.ariaLabel === 'string' ? c.ariaLabel.trim() : '',
    display: c.display === 'codes' ? 'codes' : 'labels',
  }
}

export function readSpacerConfig(config: LayoutSlotConfig | undefined): SpacerParticleConfig {
  const c = config ?? {}
  const defaults = defaultSpacerConfig()
  const heightRaw = Number(c.height)
  const height =
    Number.isFinite(heightRaw) && heightRaw > 0
      ? Math.min(2400, Math.round(heightRaw))
      : defaults.height
  const widthRaw = Number(c.width)
  const width =
    Number.isFinite(widthRaw) && widthRaw > 0 ? Math.min(2400, Math.round(widthRaw)) : undefined
  return width != null ? { height, width } : { height }
}

export function readAccountMenuConfig(
  config: LayoutSlotConfig | undefined,
): AccountMenuParticleConfig {
  const c = config ?? {}
  const defaults = defaultAccountMenuConfig()
  return {
    avatarShape: normalizeAccountMenuAvatarShape(c.avatarShape),
    avatarSize: clampAccountMenuAvatarSize(c.avatarSize, defaults.avatarSize),
  }
}
