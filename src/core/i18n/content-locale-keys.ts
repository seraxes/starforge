/**
 * Stable content-string keys — belonging contract for LocaleInput values.
 * Keys are opaque to translators; only values should change in locale files.
 */

export const CONTENT_LOCALE_FIELDS = [
  'title',
  'html',
  'text',
  'label',
  'welcomeNote',
  'browserTitle',
  'pageHeading',
] as const

export type ContentLocaleField = (typeof CONTENT_LOCALE_FIELDS)[number]

const FIELD_SET = new Set<string>(CONTENT_LOCALE_FIELDS)

export const CHROME_CONSENT_FIELDS = ['message', 'privacyUrl', 'privacyLinkLabel'] as const

export type ChromeConsentField = (typeof CHROME_CONSENT_FIELDS)[number]

const CHROME_CONSENT_FIELD_SET = new Set<string>(CHROME_CONSENT_FIELDS)

/** Safe id segment for keys / filenames (layout ids, slot ids, menu ids). */
export function sanitizeContentLocaleId(raw: string): string {
  return raw
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96)
}

export function buildLayoutSlotKey(input: {
  layoutId: string
  slotId: string
  field: ContentLocaleField
  itemId?: string
}): string {
  const layoutId = sanitizeContentLocaleId(input.layoutId) || 'default'
  const slotId = sanitizeContentLocaleId(input.slotId) || 'slot'
  if (input.itemId?.trim()) {
    const itemId = sanitizeContentLocaleId(input.itemId) || 'item'
    return `layout.${layoutId}.slot.${slotId}.item.${itemId}.${input.field}`
  }
  return `layout.${layoutId}.slot.${slotId}.${input.field}`
}

export function buildNavItemKey(input: {
  menuId: string
  itemId: string
  field: 'label' | 'browserTitle' | 'pageHeading'
}): string {
  const menuId = sanitizeContentLocaleId(input.menuId) || 'main'
  const itemId = sanitizeContentLocaleId(input.itemId) || 'item'
  return `nav.${menuId}.item.${itemId}.${input.field}`
}

/** Site Chrome consent policy copy — owner file chrome/consent.json. */
export function buildChromeConsentKey(field: ChromeConsentField): string {
  return `chrome.consent.${field}`
}

export type ParsedContentLocaleKey =
  | {
      kind: 'layout'
      layoutId: string
      slotId: string
      itemId?: string
      field: ContentLocaleField
    }
  | {
      kind: 'nav'
      menuId: string
      itemId: string
      field: 'label' | 'browserTitle' | 'pageHeading'
    }
  | {
      kind: 'chrome'
      ownerId: 'consent'
      field: ChromeConsentField
    }

export function parseContentLocaleKey(raw: string): ParsedContentLocaleKey | null {
  const key = raw.trim()
  if (!key || key.startsWith('_')) return null

  const layoutItem = /^layout\.([^.]+)\.slot\.([^.]+)\.item\.([^.]+)\.([^.]+)$/.exec(key)
  if (layoutItem) {
    const field = layoutItem[4]!
    if (!FIELD_SET.has(field)) return null
    return {
      kind: 'layout',
      layoutId: layoutItem[1]!,
      slotId: layoutItem[2]!,
      itemId: layoutItem[3]!,
      field: field as ContentLocaleField,
    }
  }

  const layoutSlot = /^layout\.([^.]+)\.slot\.([^.]+)\.([^.]+)$/.exec(key)
  if (layoutSlot) {
    const field = layoutSlot[3]!
    if (!FIELD_SET.has(field)) return null
    return {
      kind: 'layout',
      layoutId: layoutSlot[1]!,
      slotId: layoutSlot[2]!,
      field: field as ContentLocaleField,
    }
  }

  const navItem = /^nav\.([^.]+)\.item\.([^.]+)\.([^.]+)$/.exec(key)
  if (navItem) {
    const field = navItem[3]!
    if (field !== 'label' && field !== 'browserTitle' && field !== 'pageHeading') return null
    return {
      kind: 'nav',
      menuId: navItem[1]!,
      itemId: navItem[2]!,
      field,
    }
  }

  const chromeConsent = /^chrome\.consent\.([^.]+)$/.exec(key)
  if (chromeConsent) {
    const field = chromeConsent[1]!
    if (!CHROME_CONSENT_FIELD_SET.has(field)) return null
    return {
      kind: 'chrome',
      ownerId: 'consent',
      field: field as ChromeConsentField,
    }
  }

  return null
}

export function isValidContentLocaleKey(raw: string): boolean {
  return parseContentLocaleKey(raw) != null
}

/** Owner file under a locale folder: layouts|nav|chrome/{id}.json */
export function contentLocaleFileRefForKey(key: string): {
  scope: 'layouts' | 'nav' | 'chrome'
  ownerId: string
} | null {
  const parsed = parseContentLocaleKey(key)
  if (!parsed) return null
  if (parsed.kind === 'layout') {
    return { scope: 'layouts', ownerId: parsed.layoutId }
  }
  if (parsed.kind === 'nav') {
    return { scope: 'nav', ownerId: parsed.menuId }
  }
  return { scope: 'chrome', ownerId: parsed.ownerId }
}
