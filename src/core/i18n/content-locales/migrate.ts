import 'server-only'

import { listLayoutOutlines, loadLayoutDocument, saveLayoutDocument } from '@/core/modules/layout-store'
import { listNavMenus, loadNavMenu, saveNavMenuDocument } from '@/core/nav/store'

import { syncLayoutSlotLocalesToFiles, syncNavItemLocalesToFiles } from './sync'

export type ContentLocaleMigrationResult = {
  layouts: number
  navMenus: number
  slotsTouched: number
  navItemsTouched: number
}

/**
 * Walk layout + nav documents, write embedded locale maps to language folders,
 * and strip the maps from the documents. Idempotent.
 */
export async function migrateEmbeddedContentLocalesToFiles(): Promise<ContentLocaleMigrationResult> {
  let layouts = 0
  let navMenus = 0
  let slotsTouched = 0
  let navItemsTouched = 0

  const outlines = await listLayoutOutlines()
  for (const outline of outlines) {
    const { document, layoutId } = await loadLayoutDocument(outline.id)
    let changed = false
    for (const section of document.sections) {
      for (const row of section.rows) {
        for (const slot of row.slots) {
          const cfg = slot.config
          if (!cfg || typeof cfg !== 'object') continue
          const before = JSON.stringify(cfg)
          const next = await syncLayoutSlotLocalesToFiles({
            layoutId,
            slotId: slot.id,
            config: { ...(cfg as Record<string, unknown>) },
          })
          if (JSON.stringify(next) !== before) {
            slot.config = next
            changed = true
            slotsTouched += 1
          }
        }
      }
    }
    if (changed) {
      await saveLayoutDocument(document, layoutId)
      layouts += 1
    }
  }

  const menus = await listNavMenus()
  for (const menu of menus) {
    const loaded = await loadNavMenu(menu.id)
    const doc = loaded.document
    const items = doc.items.map((item) => ({ ...item }) as Record<string, unknown>)
    const hadMaps = items.some(
      (item) => item.labels || item.browserTitles || item.pageHeadings,
    )
    if (!hadMaps) continue
    const nextItems = await syncNavItemLocalesToFiles({ menuId: menu.id, items })
    doc.items = nextItems as typeof doc.items
    await saveNavMenuDocument(menu.id, doc)
    navMenus += 1
    navItemsTouched += items.length
  }

  return { layouts, navMenus, slotsTouched, navItemsTouched }
}
