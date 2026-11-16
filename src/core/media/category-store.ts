import 'server-only'

import {
  MEDIA_CATEGORY_MAX_DEPTH,
  MEDIA_FORMS_CATEGORY_SLUG,
  buildCategoryTree,
  folderFromCategorySlug,
  slugifyCategoryName,
  type MediaCategoryNode,
} from './categories'
import {
  countAssetsInCategory,
  countChildCategories,
  deleteCategoryRow,
  getCategoryBySlug,
  getCategoryRow,
  insertCategoryRow,
  listCategoryRows,
  updateCategoryPath,
  updateCategoryPathOnly,
  type CategoryRow,
} from './document-store'
import { normalizeMediaFolder, type MediaFolder } from './pipeline'
import { ensureLocalMediaDir, removeLocalMediaDirIfEmpty } from './storage/local'
import { storagePrefixFromChain } from './storage-key'

export { getCategoryBySlug }

function toFound(row: CategoryRow) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    parentId: row.parentId,
    path: row.path,
    depth: row.depth,
  }
}

/** List nested categories as a forest for the Media sidebar / picker. */
export async function listMediaCategoryTree(): Promise<MediaCategoryNode[]> {
  try {
    const rows = await listCategoryRows()
    return buildCategoryTree(rows)
  } catch {
    return []
  }
}

/** Ensure legacy MEDIA_FOLDERS exist as root categories. */
export async function ensureLegacyCategoryRoots(): Promise<void> {
  const seeds = [
    { title: 'General', slug: 'general' },
    { title: 'Logos', slug: 'logos' },
    { title: 'Backgrounds', slug: 'backgrounds' },
    { title: 'Pages', slug: 'pages' },
    { title: 'Forms', slug: MEDIA_FORMS_CATEGORY_SLUG },
  ]
  for (const seed of seeds) {
    const existing = await getCategoryBySlug(seed.slug)
    if (!existing) {
      await insertCategoryRow({
        title: seed.title,
        slug: seed.slug,
        parentId: null,
        path: seed.title,
        depth: 0,
      })
    }
    try {
      await ensureLocalMediaDir(seed.slug)
    } catch {
      // The row is enough. The next upload creates the folder for its own file.
    }
  }
}

export async function findCategoryById(id: string | number): Promise<{
  id: string
  title: string
  slug: string
  parentId: string | null
  path: string
  depth: number
} | null> {
  const row = await getCategoryRow(String(id ?? '').trim())
  return row ? toFound(row) : null
}

/**
 * Object-key prefix for a category: parent slugs then this slug (`logos/events`).
 * Missing ids use `general`.
 */
export async function storagePrefixForCategory(
  categoryId: string | null | undefined,
): Promise<string> {
  const id = String(categoryId ?? '').trim()
  if (!id) return storagePrefixFromChain([])
  const rows = await listCategoryRows()
  const byId = new Map(rows.map((row) => [row.id, row]))
  const slugs: string[] = []
  let walk: string | null = id
  const guard = new Set<string>()
  while (walk && !guard.has(walk)) {
    guard.add(walk)
    const row = byId.get(walk)
    if (!row) break
    slugs.push(row.slug)
    walk = row.parentId
  }
  slugs.reverse()
  return storagePrefixFromChain(slugs)
}

/** Resolve legacy folder enum for uploads given a category id. */
export async function resolveFolderForCategory(
  categoryId: string | null | undefined,
): Promise<MediaFolder> {
  if (!categoryId) return 'general'
  const cat = await findCategoryById(categoryId)
  if (!cat) return 'general'
  if (cat.slug === MEDIA_FORMS_CATEGORY_SLUG) {
    return normalizeMediaFolder('forms')
  }
  const mapped = folderFromCategorySlug(cat.slug)
  if (mapped !== 'general' || cat.slug === 'general') return mapped
  let walk = cat.parentId
  let guard = 0
  while (walk && guard < MEDIA_CATEGORY_MAX_DEPTH + 2) {
    guard += 1
    const parent = await findCategoryById(walk)
    if (!parent) break
    if (parent.slug === MEDIA_FORMS_CATEGORY_SLUG) {
      return normalizeMediaFolder('forms')
    }
    const hit = folderFromCategorySlug(parent.slug)
    if (hit !== 'general' || parent.slug === 'general') return hit
    walk = parent.parentId
  }
  return 'general'
}

export async function createMediaCategory(input: {
  title: string
  parentId?: string | null
}): Promise<{ error?: string; category?: Awaited<ReturnType<typeof findCategoryById>> }> {
  const title = String(input.title ?? '').trim()
  if (!title) return { error: 'Folder name is required.' }

  let parentId: string | null = input.parentId ? String(input.parentId).trim() : null
  if (parentId === '' || parentId === 'all') parentId = null

  try {
    let depth = 0
    let path = title
    if (parentId) {
      const parent = await findCategoryById(parentId)
      if (!parent) return { error: 'Parent folder not found.' }
      if (parent.depth >= MEDIA_CATEGORY_MAX_DEPTH) {
        return { error: `Cannot nest deeper than ${MEDIA_CATEGORY_MAX_DEPTH} levels.` }
      }
      depth = parent.depth + 1
      path = parent.path ? `${parent.path} / ${title}` : title
    }

    let slug = slugifyCategoryName(title)
    const clash = await getCategoryBySlug(slug)
    if (clash) {
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`
    }

    const row = await insertCategoryRow({
      title,
      slug,
      parentId,
      path,
      depth,
    })
    try {
      await ensureLocalMediaDir(await storagePrefixForCategory(row.id))
    } catch {
      // The category row exists. The next library open creates the folder.
    }
    return { category: toFound(row) }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not create folder.' }
  }
}

export async function renameMediaCategory(input: {
  id: string
  title: string
}): Promise<{ error?: string; category?: Awaited<ReturnType<typeof findCategoryById>> }> {
  const id = String(input.id ?? '').trim()
  const title = String(input.title ?? '').trim()
  if (!id) return { error: 'Missing folder id.' }
  if (!title) return { error: 'Folder name is required.' }

  try {
    const cat = await findCategoryById(id)
    if (!cat) return { error: 'Folder not found.' }
    const parent = cat.parentId ? await findCategoryById(cat.parentId) : null
    const nextPath = parent?.path ? `${parent.path} / ${title}` : title
    const oldPath = cat.path
    await updateCategoryPath(id, nextPath, title)
    if (oldPath && oldPath !== nextPath) {
      const prefix = `${oldPath} / `
      const all = await listCategoryRows()
      for (const row of all) {
        if (row.id === id) continue
        if (!row.path.startsWith(prefix)) continue
        await updateCategoryPathOnly(row.id, nextPath + row.path.slice(oldPath.length))
      }
    }
    const category = await findCategoryById(id)
    return category ? { category } : { error: 'Renamed but failed to reload.' }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not rename folder.' }
  }
}

export async function deleteMediaCategory(input: {
  id: string
}): Promise<{ error?: string; ok?: boolean }> {
  const id = String(input.id ?? '').trim()
  if (!id) return { error: 'Missing folder id.' }

  try {
    const cat = await findCategoryById(id)
    if (!cat) return { error: 'Folder not found.' }
    if (cat.slug === MEDIA_FORMS_CATEGORY_SLUG) {
      return { error: 'The Forms folder is reserved and cannot be deleted.' }
    }
    if ((await countChildCategories(id)) > 0) {
      return { error: 'Folder has subfolders — move or delete them first.' }
    }
    if ((await countAssetsInCategory(id)) > 0) {
      return { error: 'Folder is not empty — move or delete media first.' }
    }
    const prefix = await storagePrefixForCategory(id)
    await deleteCategoryRow(id)
    try {
      await removeLocalMediaDirIfEmpty(prefix)
    } catch {
      // The row is gone. An empty directory can stay.
    }
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not delete folder.' }
  }
}
