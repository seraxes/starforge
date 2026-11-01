import { normalizeAccessTags } from '@/core/acl/nav-access'

import type { NavMenuDocument, NavMenuItem, NavLinkType } from './types'

export const NAV_MENU_DOCUMENT_VERSION = 1 as const

export function emptyNavMenuDocument(): NavMenuDocument {
  return { version: NAV_MENU_DOCUMENT_VERSION, items: [] }
}

export function slugifyNavMenuId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

function newItemId(): string {
  return `ni_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

/** Accept `custom` as legacy alias for `url`. */
export function normalizeLinkType(raw: unknown): NavLinkType {
  if (raw === 'module') return 'module'
  if (raw === 'url' || raw === 'custom') return 'url'
  return 'page'
}

export function normalizeNavMenuItem(
  raw: unknown,
  index: number,
): NavMenuItem | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const label = typeof row.label === 'string' ? row.label.trim() : ''
  if (!label) return null

  const id =
    typeof row.id === 'string' && row.id.trim() ? row.id.trim() : newItemId()
  const parentId =
    typeof row.parentId === 'string' && row.parentId.trim() ? row.parentId.trim() : null
  const sortOrder =
    typeof row.sortOrder === 'number' && Number.isFinite(row.sortOrder)
      ? row.sortOrder
      : index

  const linkType = normalizeLinkType(row.linkType)
  const pageId =
    typeof row.pageId === 'number' && Number.isFinite(row.pageId)
      ? row.pageId
      : typeof row.pageId === 'string' && /^\d+$/.test(row.pageId)
        ? Number(row.pageId)
        : null
  const url = typeof row.url === 'string' ? row.url.trim() : null
  const moduleId =
    typeof row.moduleId === 'string' && row.moduleId.trim() ? row.moduleId.trim() : null
  const moduleViewKey =
    typeof row.moduleViewKey === 'string' && row.moduleViewKey.trim()
      ? row.moduleViewKey.trim()
      : null

  return {
    id,
    parentId,
    sortOrder,
    label,
    linkType,
    pageId: linkType === 'page' ? pageId : null,
    url: linkType === 'url' ? url : null,
    moduleId: linkType === 'module' ? moduleId : null,
    moduleViewKey: linkType === 'module' ? moduleViewKey : null,
    cssClass: typeof row.cssClass === 'string' ? row.cssClass.trim() || null : null,
    browserTitle:
      typeof row.browserTitle === 'string' ? row.browserTitle.trim() || null : null,
    pageHeading:
      typeof row.pageHeading === 'string' ? row.pageHeading.trim() || null : null,
    accessTags: normalizeAccessTags({
      accessTags: row.accessTags,
      accessLevel: row.accessLevel,
    }),
  }
}

export function normalizeNavMenuDocument(raw: unknown): NavMenuDocument {
  if (!raw || typeof raw !== 'object') return emptyNavMenuDocument()
  const doc = raw as { version?: unknown; items?: unknown }
  const itemsRaw = Array.isArray(doc.items) ? doc.items : []
  const items: NavMenuItem[] = []
  for (let i = 0; i < itemsRaw.length; i++) {
    const item = normalizeNavMenuItem(itemsRaw[i], i)
    if (item) items.push(item)
  }
  // Re-index sortOrder among siblings after normalize
  const byParent = new Map<string | null, NavMenuItem[]>()
  for (const item of items) {
    const key = item.parentId
    const list = byParent.get(key) ?? []
    list.push(item)
    byParent.set(key, list)
  }
  for (const list of byParent.values()) {
    list
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
      .forEach((item, i) => {
        item.sortOrder = i
      })
  }
  return { version: NAV_MENU_DOCUMENT_VERSION, items }
}

export function parseNavMenuDocumentJson(json: string | null | undefined): NavMenuDocument {
  if (!json || !json.trim()) return emptyNavMenuDocument()
  try {
    return normalizeNavMenuDocument(JSON.parse(json) as unknown)
  } catch {
    return emptyNavMenuDocument()
  }
}

export function serializeNavMenuDocument(doc: NavMenuDocument): string {
  return JSON.stringify(normalizeNavMenuDocument(doc))
}

export function createNavMenuItem(
  partial: Partial<NavMenuItem> & { label: string },
  sortOrder = 0,
): NavMenuItem {
  return (
    normalizeNavMenuItem(
      {
        id: partial.id ?? newItemId(),
        parentId: partial.parentId ?? null,
        sortOrder: partial.sortOrder ?? sortOrder,
        label: partial.label,
        linkType: partial.linkType ?? 'url',
        pageId: partial.pageId ?? null,
        url: partial.url ?? null,
        moduleId: partial.moduleId ?? null,
        moduleViewKey: partial.moduleViewKey ?? null,
        cssClass: partial.cssClass ?? null,
        browserTitle: partial.browserTitle ?? null,
        pageHeading: partial.pageHeading ?? null,
        accessTags: partial.accessTags,
        accessLevel: partial.accessLevel,
      },
      sortOrder,
    ) ?? {
      id: newItemId(),
      parentId: null,
      sortOrder,
      label: partial.label,
      linkType: 'url',
      url: '/',
      accessTags: ['public'],
    }
  )
}

/** Deep-clone an item with a new id (and optional label suffix). */
export function cloneNavMenuItem(
  item: NavMenuItem,
  options?: { labelSuffix?: string; sortOrder?: number },
): NavMenuItem {
  return createNavMenuItem(
    {
      ...item,
      id: newItemId(),
      label: options?.labelSuffix ? `${item.label}${options.labelSuffix}` : item.label,
      sortOrder: options?.sortOrder ?? item.sortOrder,
    },
    options?.sortOrder ?? item.sortOrder,
  )
}

/** Ordered flat list for admin tables (parents before children). */
export function flattenNavItemsInOrder(items: NavMenuItem[]): NavMenuItem[] {
  const byParent = new Map<string | null, NavMenuItem[]>()
  for (const item of items) {
    const key = item.parentId && items.some((i) => i.id === item.parentId) ? item.parentId : null
    const list = byParent.get(key) ?? []
    list.push(item)
    byParent.set(key, list)
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
  }

  const out: NavMenuItem[] = []
  const walk = (parentId: string | null, depth: number) => {
    const children = byParent.get(parentId) ?? []
    for (const child of children) {
      out.push({ ...child, sortOrder: out.length })
      void depth
      walk(child.id, depth + 1)
    }
  }
  walk(null, 0)

  // Orphans whose parent was missing already remapped to null above
  const seen = new Set(out.map((i) => i.id))
  for (const item of items) {
    if (!seen.has(item.id)) out.push(item)
  }
  return out
}

/** Move item among siblings by delta (−1 up / +1 down). */
export function moveNavItemAmongSiblings(
  items: NavMenuItem[],
  itemId: string,
  delta: -1 | 1,
): NavMenuItem[] {
  const target = items.find((i) => i.id === itemId)
  if (!target) return items
  const parentId = target.parentId
  const siblings = items
    .filter((i) => i.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
  const index = siblings.findIndex((i) => i.id === itemId)
  const nextIndex = index + delta
  if (index < 0 || nextIndex < 0 || nextIndex >= siblings.length) return items

  const reordered = [...siblings]
  const [removed] = reordered.splice(index, 1)
  reordered.splice(nextIndex, 0, removed!)

  const orderMap = new Map(reordered.map((item, i) => [item.id, i]))
  return items.map((item) => {
    const order = orderMap.get(item.id)
    return typeof order === 'number' ? { ...item, sortOrder: order } : item
  })
}
