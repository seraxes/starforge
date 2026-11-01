import { asc, eq } from 'drizzle-orm'
import { getPayload } from 'payload'

import config from '@payload-config'
import { db, DEFAULT_NAV_MENU_ID, sfNavMenus } from '@/core/db'
import { normalizeHref } from '@/core/settings/nav'

import {
  cloneNavMenuItem,
  createNavMenuItem,
  emptyNavMenuDocument,
  flattenNavItemsInOrder,
  moveNavItemAmongSiblings,
  normalizeNavMenuDocument,
  parseNavMenuDocumentJson,
  serializeNavMenuDocument,
  slugifyNavMenuId,
} from './document'
import type { NavMenuDocument, NavMenuItem, NavMenuMeta, NavPageOption } from './types'

export type NavMenuLoadResult = {
  id: string
  label: string
  document: NavMenuDocument
  source: 'database' | 'empty'
  isFallback: boolean
}

function displayLabel(id: string, label: string | null | undefined): string {
  const trimmed = typeof label === 'string' ? label.trim() : ''
  if (trimmed) return trimmed
  if (id === DEFAULT_NAV_MENU_ID) return 'Main'
  return id
}

export async function listNavMenus(): Promise<NavMenuMeta[]> {
  try {
    const rows = await db
      .select({
        id: sfNavMenus.id,
        label: sfNavMenus.label,
        document: sfNavMenus.document,
        createdAt: sfNavMenus.createdAt,
        updatedAt: sfNavMenus.updatedAt,
      })
      .from(sfNavMenus)
      .orderBy(asc(sfNavMenus.label), asc(sfNavMenus.id))

    return rows.map((row) => {
      const doc = parseNavMenuDocumentJson(row.document)
      return {
        id: row.id,
        label: displayLabel(row.id, row.label),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        itemCount: doc.items.length,
      }
    })
  } catch {
    return []
  }
}

export async function loadNavMenu(menuId: string): Promise<NavMenuLoadResult> {
  const id = (menuId || DEFAULT_NAV_MENU_ID).trim() || DEFAULT_NAV_MENU_ID
  try {
    const [row] = await db
      .select({
        id: sfNavMenus.id,
        label: sfNavMenus.label,
        document: sfNavMenus.document,
      })
      .from(sfNavMenus)
      .where(eq(sfNavMenus.id, id))
      .limit(1)

    if (row) {
      return {
        id: row.id,
        label: displayLabel(row.id, row.label),
        document: parseNavMenuDocumentJson(row.document),
        source: 'database',
        isFallback: false,
      }
    }
  } catch {
    // Table may not exist yet.
  }

  return {
    id,
    label: displayLabel(id, null),
    document: emptyNavMenuDocument(),
    source: 'empty',
    isFallback: true,
  }
}

export async function saveNavMenuDocument(
  menuId: string,
  document: NavMenuDocument,
): Promise<{ ok: true } | { error: string }> {
  const id = menuId.trim()
  if (!id) return { error: 'Menu id is required.' }

  try {
    const [existing] = await db
      .select({ id: sfNavMenus.id, label: sfNavMenus.label })
      .from(sfNavMenus)
      .where(eq(sfNavMenus.id, id))
      .limit(1)

    if (!existing) {
      return { error: `Menu “${id}” was not found.` }
    }

    await db
      .update(sfNavMenus)
      .set({
        document: serializeNavMenuDocument(document),
        updatedAt: new Date(),
      })
      .where(eq(sfNavMenus.id, id))

    return { ok: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not save menu items.',
    }
  }
}

export async function createNavMenu(input: {
  label: string
  id?: string
  copyFromId?: string
}): Promise<{ menu: NavMenuMeta } | { error: string }> {
  const label = input.label.trim()
  if (!label) return { error: 'Name is required.' }

  let id = input.id?.trim() ? slugifyNavMenuId(input.id) : slugifyNavMenuId(label)
  if (!id) id = `menu-${Date.now().toString(36)}`

  let document = emptyNavMenuDocument()
  if (input.copyFromId?.trim()) {
    const source = await loadNavMenu(input.copyFromId.trim())
    if (!source.isFallback) {
      document = normalizeNavMenuDocument({
        version: 1,
        items: source.document.items.map((item) =>
          cloneNavMenuItem(item, { sortOrder: item.sortOrder }),
        ),
      })
    }
  }

  try {
    const [clash] = await db
      .select({ id: sfNavMenus.id })
      .from(sfNavMenus)
      .where(eq(sfNavMenus.id, id))
      .limit(1)
    if (clash) return { error: `A menu with id “${id}” already exists.` }

    const now = new Date()
    await db.insert(sfNavMenus).values({
      id,
      label,
      document: serializeNavMenuDocument(document),
      createdAt: now,
      updatedAt: now,
    })

    return {
      menu: {
        id,
        label,
        createdAt: now,
        updatedAt: now,
        itemCount: document.items.length,
      },
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not create menu.',
    }
  }
}

export async function renameNavMenu(input: {
  id: string
  label: string
}): Promise<{ menu: NavMenuMeta } | { error: string }> {
  const id = input.id.trim()
  const label = input.label.trim()
  if (!id) return { error: 'Menu id is required.' }
  if (!label) return { error: 'Name is required.' }

  try {
    const loaded = await loadNavMenu(id)
    if (loaded.isFallback && loaded.source === 'empty') {
      return { error: `Menu “${id}” was not found.` }
    }

    const now = new Date()
    await db
      .update(sfNavMenus)
      .set({ label, updatedAt: now })
      .where(eq(sfNavMenus.id, id))

    return {
      menu: {
        id,
        label,
        createdAt: loaded.source === 'database' ? now : now,
        updatedAt: now,
        itemCount: loaded.document.items.length,
      },
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not rename menu.',
    }
  }
}

export async function duplicateNavMenu(input: {
  id: string
  label?: string
  newId?: string
}): Promise<{ menu: NavMenuMeta } | { error: string }> {
  const source = await loadNavMenu(input.id.trim())
  if (source.isFallback && source.source === 'empty') {
    return { error: `Menu “${input.id}” was not found.` }
  }
  const label = (input.label?.trim() || `${source.label} copy`).slice(0, 80)
  return createNavMenu({
    label,
    ...(input.newId?.trim() ? { id: input.newId.trim() } : {}),
    copyFromId: source.id,
  })
}

export async function deleteNavMenu(
  menuId: string,
): Promise<{ ok: true } | { error: string }> {
  const id = menuId.trim()
  if (!id) return { error: 'Menu id is required.' }
  if (id === DEFAULT_NAV_MENU_ID) {
    return { error: 'The default Main menu cannot be deleted.' }
  }

  try {
    const result = await db.delete(sfNavMenus).where(eq(sfNavMenus.id, id)).returning({
      id: sfNavMenus.id,
    })
    if (result.length === 0) return { error: `Menu “${id}” was not found.` }
    return { ok: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not delete menu.',
    }
  }
}

export async function replaceNavMenuItems(
  menuId: string,
  items: NavMenuItem[],
): Promise<{ ok: true; document: NavMenuDocument } | { error: string }> {
  const document = normalizeNavMenuDocument({ version: 1, items })
  const saved = await saveNavMenuDocument(menuId, document)
  if ('error' in saved) return saved
  return { ok: true, document }
}

export async function reorderNavMenuItem(
  menuId: string,
  itemId: string,
  delta: -1 | 1,
): Promise<{ ok: true; document: NavMenuDocument } | { error: string }> {
  const loaded = await loadNavMenu(menuId)
  if (loaded.isFallback && loaded.source === 'empty') {
    return { error: `Menu “${menuId}” was not found.` }
  }
  const nextItems = moveNavItemAmongSiblings(loaded.document.items, itemId, delta)
  return replaceNavMenuItems(menuId, nextItems)
}

/** List CMS pages for the admin page-bind picker. */
export async function listNavPageOptions(): Promise<NavPageOption[]> {
  try {
    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'pages',
      depth: 0,
      limit: 200,
      sort: 'title',
      overrideAccess: true,
      pagination: false,
    })
    return result.docs
      .map((doc) => {
        if (typeof doc.id !== 'number') return null
        const title = typeof doc.title === 'string' ? doc.title : String(doc.id)
        const slug = typeof doc.slug === 'string' ? doc.slug : ''
        if (!slug) return null
        return { id: doc.id, title, slug }
      })
      .filter((row): row is NavPageOption => row != null)
  } catch {
    return []
  }
}

/**
 * Migrate leftover Payload `site-settings.primaryNav` rows into the Main menu
 * when Main is missing or empty. Idempotent — never overwrites a non-empty Main.
 */
export async function migrateLegacyPrimaryNavToMain(legacyRows: unknown): Promise<{
  migrated: boolean
  itemCount: number
}> {
  const loaded = await loadNavMenu(DEFAULT_NAV_MENU_ID)
  if (!loaded.isFallback && loaded.document.items.length > 0) {
    return { migrated: false, itemCount: loaded.document.items.length }
  }

  if (!Array.isArray(legacyRows) || legacyRows.length === 0) {
    if (loaded.isFallback) {
      await ensureDefaultNavMenuSeeded()
    }
    return { migrated: false, itemCount: 0 }
  }

  const items: NavMenuItem[] = []
  let order = 0
  for (const raw of legacyRows) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as {
      label?: unknown
      linkType?: unknown
      page?: unknown
      url?: unknown
      href?: unknown
      cssClass?: unknown
      browserTitle?: unknown
    }
    const label = typeof row.label === 'string' ? row.label.trim() : ''
    if (!label) continue

    const cssClass = typeof row.cssClass === 'string' ? row.cssClass.trim() : null
    const browserTitle = typeof row.browserTitle === 'string' ? row.browserTitle.trim() : null

    let pageId: number | null = null
    if (typeof row.page === 'number') pageId = row.page
    else if (row.page && typeof row.page === 'object' && typeof (row.page as { id?: unknown }).id === 'number') {
      pageId = (row.page as { id: number }).id
    }

    const linkType = row.linkType === 'custom' ? 'custom' : row.linkType === 'page' ? 'page' : null

    if (linkType === 'page' || (!linkType && pageId != null)) {
      if (pageId == null) continue
      items.push(
        createNavMenuItem(
          {
            label,
            linkType: 'page',
            pageId,
            cssClass,
            browserTitle,
            accessLevel: 'public',
          },
          order++,
        ),
      )
      continue
    }

    const urlRaw =
      typeof row.url === 'string' && row.url.trim()
        ? row.url
        : typeof row.href === 'string'
          ? row.href
          : ''
    const url = normalizeHref(urlRaw)
    if (!url) continue
    items.push(
      createNavMenuItem(
        {
          label,
          linkType: 'custom',
          url,
          cssClass,
          browserTitle,
          accessLevel: 'public',
        },
        order++,
      ),
    )
  }

  if (items.length === 0) {
    if (loaded.isFallback) await ensureDefaultNavMenuSeeded()
    return { migrated: false, itemCount: 0 }
  }

  const now = new Date()
  const document = normalizeNavMenuDocument({ version: 1, items })

  if (loaded.isFallback) {
    try {
      await db.insert(sfNavMenus).values({
        id: DEFAULT_NAV_MENU_ID,
        label: 'Main',
        document: serializeNavMenuDocument(document),
        createdAt: now,
        updatedAt: now,
      })
    } catch {
      await replaceNavMenuItems(DEFAULT_NAV_MENU_ID, items)
    }
  } else {
    await replaceNavMenuItems(DEFAULT_NAV_MENU_ID, items)
  }

  return { migrated: true, itemCount: items.length }
}

/**
 * Ensure the default Main menu exists. Optionally seed items from page entries
 * or legacy custom hrefs. Idempotent when Main already has items.
 */
export async function ensureDefaultNavMenuSeeded(options?: {
  pageEntries?: Array<{ label: string; slug: string }>
  legacyCustom?: Array<{ label: string; href: string }>
}): Promise<{ created: boolean; updated: boolean; menuId: string }> {
  const existing = await loadNavMenu(DEFAULT_NAV_MENU_ID)
  if (!existing.isFallback && existing.document.items.length > 0) {
    return { created: false, updated: false, menuId: existing.id }
  }
  // Empty Main row exists — fall through to fill when options provided.
  if (!existing.isFallback && !options?.pageEntries?.length && !options?.legacyCustom?.length) {
    return { created: false, updated: false, menuId: existing.id }
  }

  const items: NavMenuItem[] = []

  if (options?.pageEntries?.length) {
    try {
      const payload = await getPayload({ config })
      let order = 0
      for (const entry of options.pageEntries) {
        const found = await payload.find({
          collection: 'pages',
          where: { slug: { equals: entry.slug } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        const doc = found.docs[0]
        if (!doc || typeof doc.id !== 'number') continue
        items.push(
          createNavMenuItem(
            {
              label: entry.label,
              linkType: 'page',
              pageId: doc.id,
              accessLevel: 'public',
            },
            order++,
          ),
        )
      }
    } catch {
      // Payload unavailable — fall through to legacy custom.
    }
  }

  if (items.length === 0 && options?.legacyCustom?.length) {
    options.legacyCustom.forEach((entry, i) => {
      items.push(
        createNavMenuItem(
          {
            label: entry.label,
            linkType: 'custom',
            url: normalizeHref(entry.href),
            accessLevel: 'public',
          },
          i,
        ),
      )
    })
  }

  const now = new Date()
  const document = normalizeNavMenuDocument({ version: 1, items })

  try {
    await db.insert(sfNavMenus).values({
      id: DEFAULT_NAV_MENU_ID,
      label: 'Main',
      document: serializeNavMenuDocument(document),
      createdAt: now,
      updatedAt: now,
    })
    return { created: true, updated: false, menuId: DEFAULT_NAV_MENU_ID }
  } catch {
    // Race: row appeared — try update only if empty
    const again = await loadNavMenu(DEFAULT_NAV_MENU_ID)
    if (!again.isFallback && again.document.items.length === 0 && items.length > 0) {
      await replaceNavMenuItems(DEFAULT_NAV_MENU_ID, items)
      return { created: false, updated: true, menuId: DEFAULT_NAV_MENU_ID }
    }
    return {
      created: false,
      updated: false,
      menuId: again.id || DEFAULT_NAV_MENU_ID,
    }
  }
}

/**
 * Seed / refresh Main menu page links when empty or still on sample paths only.
 * Used by `npm run seed` (replaces legacy site-settings.primaryNav seeding).
 */
export async function seedMainNavFromPages(
  entries: Array<{ label: string; slug: string }>,
): Promise<{ updated: boolean; itemCount: number }> {
  await ensureDefaultNavMenuSeeded()
  const loaded = await loadNavMenu(DEFAULT_NAV_MENU_ID)
  if (!loaded.isFallback && loaded.document.items.length > 0) {
    // Already customized — leave alone
    const hasOnlyPageOrEmpty = loaded.document.items.every(
      (item) => item.linkType === 'page' || item.linkType === 'custom',
    )
    if (hasOnlyPageOrEmpty && loaded.document.items.some((i) => i.linkType === 'page')) {
      return { updated: false, itemCount: loaded.document.items.length }
    }
    if (loaded.document.items.length > 0) {
      return { updated: false, itemCount: loaded.document.items.length }
    }
  }

  const items: NavMenuItem[] = []
  try {
    const payload = await getPayload({ config })
    let order = 0
    for (const entry of entries) {
      const found = await payload.find({
        collection: 'pages',
        where: { slug: { equals: entry.slug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const doc = found.docs[0]
      if (!doc || typeof doc.id !== 'number') continue
      items.push(
        createNavMenuItem(
          {
            label: entry.label,
            linkType: 'page',
            pageId: doc.id,
            accessLevel: 'public',
          },
          order++,
        ),
      )
    }
  } catch {
    return { updated: false, itemCount: loaded.document.items.length }
  }

  if (items.length === 0) {
    return { updated: false, itemCount: 0 }
  }

  // Upsert Main
  if (loaded.isFallback) {
    const now = new Date()
    await db.insert(sfNavMenus).values({
      id: DEFAULT_NAV_MENU_ID,
      label: 'Main',
      document: serializeNavMenuDocument({ version: 1, items }),
      createdAt: now,
      updatedAt: now,
    })
  } else {
    await replaceNavMenuItems(DEFAULT_NAV_MENU_ID, items)
  }

  return { updated: true, itemCount: items.length }
}

export { flattenNavItemsInOrder, DEFAULT_NAV_MENU_ID }
