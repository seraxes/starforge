import 'server-only'

import { buildLayoutSlotKey, buildNavItemKey } from '../content-locale-keys'
import { getLocalizationSettings } from '@/core/localization/store'
import type { LayoutDocument } from '@/core/modules/types'
import type { NavMenuDocument } from '@/core/nav/types'

import { loadContentLocaleCatalog, pickFromContentCatalog } from './store'

async function enabledLocales(): Promise<string[]> {
  const settings = await getLocalizationSettings()
  const codes = settings.localesEnabled.length
    ? settings.localesEnabled
    : [settings.defaultLocale]
  return codes
}

function mapForKey(
  catalogs: Map<string, Record<string, string>>,
  key: string,
  locales: string[],
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const locale of locales) {
    const value = pickFromContentCatalog(catalogs.get(locale), key)
    if (value) out[locale] = value
  }
  return out
}

/** Fill *Locales maps on a layout document from language files (admin editor). */
export async function hydrateLayoutDocumentLocales(
  layoutId: string,
  document: LayoutDocument,
): Promise<LayoutDocument> {
  const locales = await enabledLocales()
  const catalogs = new Map<string, Record<string, string>>()
  for (const locale of locales) {
    catalogs.set(locale, await loadContentLocaleCatalog(locale))
  }

  for (const section of document.sections) {
    for (const row of section.rows) {
      for (const slot of row.slots) {
        const cfg = slot.config
        if (!cfg || typeof cfg !== 'object') continue
        const next = { ...(cfg as Record<string, unknown>) }

        for (const field of ['title', 'html', 'text', 'welcomeNote'] as const) {
          const key = buildLayoutSlotKey({ layoutId, slotId: slot.id, field })
          const map = mapForKey(catalogs, key, locales)
          if (Object.keys(map).length > 0) next[`${field}Locales`] = map
        }

        if (Array.isArray(next.items)) {
          next.items = next.items.map((raw) => {
            if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw
            const item = { ...(raw as Record<string, unknown>) }
            const itemId = typeof item.id === 'string' ? item.id : ''
            if (!itemId) return item
            const key = buildLayoutSlotKey({
              layoutId,
              slotId: slot.id,
              field: 'label',
              itemId,
            })
            const map = mapForKey(catalogs, key, locales)
            if (Object.keys(map).length > 0) item.labelLocales = map
            return item
          })
        }

        slot.config = next
      }
    }
  }
  return document
}

/** Fill nav locale maps from language files (admin editor). */
export async function hydrateNavDocumentLocales(
  menuId: string,
  document: NavMenuDocument,
): Promise<NavMenuDocument> {
  const locales = await enabledLocales()
  const catalogs = new Map<string, Record<string, string>>()
  for (const locale of locales) {
    catalogs.set(locale, await loadContentLocaleCatalog(locale))
  }

  document.items = document.items.map((item) => {
    const next = { ...item }
    const labelMap = mapForKey(
      catalogs,
      buildNavItemKey({ menuId, itemId: item.id, field: 'label' }),
      locales,
    )
    const browserMap = mapForKey(
      catalogs,
      buildNavItemKey({ menuId, itemId: item.id, field: 'browserTitle' }),
      locales,
    )
    const headingMap = mapForKey(
      catalogs,
      buildNavItemKey({ menuId, itemId: item.id, field: 'pageHeading' }),
      locales,
    )
    if (Object.keys(labelMap).length > 0) next.labels = labelMap
    if (Object.keys(browserMap).length > 0) next.browserTitles = browserMap
    if (Object.keys(headingMap).length > 0) next.pageHeadings = headingMap
    return next
  })
  return document
}
