import { getPayload } from 'payload'

import config from '@payload-config'

import {
  MEDIA_CATEGORY_MAX_DEPTH,
  MEDIA_FORMS_CATEGORY_SLUG,
  buildCategoryTree,
  folderFromCategorySlug,
  slugifyCategoryName,
  type MediaCategoryNode,
} from './categories'
import { normalizeMediaFolder, type MediaFolder } from './pipeline'

function parentIdOf(raw: unknown): string | null {
  if (raw == null) return null
  if (typeof raw === 'object' && raw !== null && 'id' in raw) {
    return String((raw as { id: number | string }).id)
  }
  return String(raw)
}

/** List nested categories as a forest for the Media sidebar / picker. */
export async function listMediaCategoryTree(): Promise<MediaCategoryNode[]> {
  try {
    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'categories',
      limit: 500,
      sort: 'title',
      depth: 0,
      overrideAccess: true,
    })
    const rows = result.docs.map((doc) => ({
      id: String(doc.id),
      title: typeof doc.title === 'string' ? doc.title : String(doc.id),
      slug: typeof doc.slug === 'string' ? doc.slug : '',
      parentId: parentIdOf(doc.parent),
      path: typeof doc.path === 'string' ? doc.path : null,
      depth: typeof doc.depth === 'number' ? doc.depth : Number(doc.depth) || 0,
    }))
    return buildCategoryTree(rows)
  } catch {
    return []
  }
}

/** Ensure legacy MEDIA_FOLDERS exist as root categories (dev DBs before migrate). */
export async function ensureLegacyCategoryRoots(): Promise<void> {
  const payload = await getPayload({ config })
  const seeds = [
    { title: 'General', slug: 'general' },
    { title: 'Logos', slug: 'logos' },
    { title: 'Backgrounds', slug: 'backgrounds' },
    { title: 'Pages', slug: 'pages' },
    { title: 'Forms', slug: MEDIA_FORMS_CATEGORY_SLUG },
  ]
  for (const seed of seeds) {
    const existing = await payload.find({
      collection: 'categories',
      where: { slug: { equals: seed.slug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs.length) continue
    await payload.create({
      collection: 'categories',
      data: {
        title: seed.title,
        slug: seed.slug,
        path: seed.title,
        depth: 0,
      },
      overrideAccess: true,
    })
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
  const raw = String(id ?? '').trim()
  if (!raw) return null
  try {
    const payload = await getPayload({ config })
    const doc = await payload.findByID({
      collection: 'categories',
      id: raw,
      depth: 0,
      overrideAccess: true,
    })
    return {
      id: String(doc.id),
      title: typeof doc.title === 'string' ? doc.title : String(doc.id),
      slug: typeof doc.slug === 'string' ? doc.slug : '',
      parentId: parentIdOf(doc.parent),
      path: typeof doc.path === 'string' ? doc.path : '',
      depth: typeof doc.depth === 'number' ? doc.depth : Number(doc.depth) || 0,
    }
  } catch {
    return null
  }
}

/** Resolve legacy folder enum for uploads given a category id. */
export async function resolveFolderForCategory(
  categoryId: string | null | undefined,
): Promise<MediaFolder> {
  if (!categoryId) return 'general'
  const cat = await findCategoryById(categoryId)
  if (!cat) return 'general'
  // Walk slug first; Forms reserved slug always wins.
  if (cat.slug === MEDIA_FORMS_CATEGORY_SLUG) {
    return normalizeMediaFolder('forms')
  }
  const mapped = folderFromCategorySlug(cat.slug)
  if (mapped !== 'general' || cat.slug === 'general') return mapped
  // Nested under a legacy root? climb parents via tree list.
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
    const payload = await getPayload({ config })
    if (parentId) {
      const parent = await findCategoryById(parentId)
      if (!parent) return { error: 'Parent folder not found.' }
      if (parent.depth >= MEDIA_CATEGORY_MAX_DEPTH) {
        return { error: `Cannot nest deeper than ${MEDIA_CATEGORY_MAX_DEPTH} levels.` }
      }
    }

    let slug = slugifyCategoryName(title)
    const clash = await payload.find({
      collection: 'categories',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (clash.docs.length) {
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`
    }

    const doc = await payload.create({
      collection: 'categories',
      data: {
        title,
        slug,
        ...(parentId ? { parent: Number(parentId) } : { parent: null }),
      },
      overrideAccess: true,
    })
    const category = await findCategoryById(doc.id)
    return category ? { category } : { error: 'Created folder but failed to reload.' }
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
    const payload = await getPayload({ config })
    await payload.update({
      collection: 'categories',
      id,
      data: { title },
      overrideAccess: true,
    })
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
    const payload = await getPayload({ config })
    const cat = await findCategoryById(id)
    if (!cat) return { error: 'Folder not found.' }
    if (cat.slug === MEDIA_FORMS_CATEGORY_SLUG) {
      return { error: 'The Forms folder is reserved and cannot be deleted.' }
    }

    const children = await payload.find({
      collection: 'categories',
      where: { parent: { equals: Number(id) } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (children.docs.length) {
      return { error: 'Folder has subfolders — move or delete them first.' }
    }

    const media = await payload.find({
      collection: 'media',
      where: { category: { equals: Number(id) } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (media.docs.length) {
      return { error: 'Folder is not empty — move or delete media first.' }
    }

    await payload.delete({
      collection: 'categories',
      id,
      overrideAccess: true,
    })
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not delete folder.' }
  }
}
