/**
 * Nested Media Categories helpers (Phase 2).
 * Categories = file-manager folders; Tags stay flat. One Payload Media store.
 */

import { MEDIA_FOLDERS, type MediaFolder } from './pipeline'

/** Practical nest limit (spec: 4–6). */
export const MEDIA_CATEGORY_MAX_DEPTH = 6

/** Reserved slug for Form respondent attachments (privacy via folder=forms). */
export const MEDIA_FORMS_CATEGORY_SLUG = 'forms'

export type MediaCategoryNode = {
  id: string
  title: string
  slug: string
  parentId: string | null
  path: string
  depth: number
  children: MediaCategoryNode[]
}

export function slugifyCategoryName(raw: string): string {
  const base = String(raw ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
  return base || `folder-${Date.now().toString(36)}`
}

/** Seed roots matching legacy MEDIA_FOLDERS (slug = folder value). */
export function legacyFolderSeedCategories(): Array<{
  title: string
  slug: MediaFolder
  path: string
  depth: 0
}> {
  return MEDIA_FOLDERS.map((f) => ({
    title: f.label,
    slug: f.value,
    path: f.label,
    depth: 0 as const,
  }))
}

/**
 * Map a category (by slug walk) back onto the legacy flat `folder` select
 * so Form privacy (`forms`) and Payload options keep working during migrate.
 */
export function folderFromCategorySlug(slug: string | null | undefined): MediaFolder {
  const s = (slug ?? '').trim()
  if (!s) return 'general'
  const hit = MEDIA_FOLDERS.find((f) => f.value === s)
  return hit ? hit.value : 'general'
}

/** Flatten tree for <select> options (indent by depth). */
export function flattenCategoryOptions(
  tree: MediaCategoryNode[],
): Array<{ id: string; title: string; slug: string; depth: number; path: string }> {
  const out: Array<{ id: string; title: string; slug: string; depth: number; path: string }> = []
  const walk = (nodes: MediaCategoryNode[]) => {
    for (const n of nodes) {
      out.push({
        id: n.id,
        title: n.title,
        slug: n.slug,
        depth: n.depth,
        path: n.path || n.title,
      })
      if (n.children.length) walk(n.children)
    }
  }
  walk(tree)
  return out
}

/** Build a forest from flat rows (parentId links). */
export function buildCategoryTree(
  rows: Array<{
    id: string
    title: string
    slug: string
    parentId: string | null
    path?: string | null
    depth?: number | null
  }>,
): MediaCategoryNode[] {
  const map = new Map<string, MediaCategoryNode>()
  for (const row of rows) {
    map.set(row.id, {
      id: row.id,
      title: row.title,
      slug: row.slug,
      parentId: row.parentId,
      path: (row.path || row.title || '').trim() || row.title,
      depth: typeof row.depth === 'number' && Number.isFinite(row.depth) ? row.depth : 0,
      children: [],
    })
  }
  const roots: MediaCategoryNode[] = []
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  const sortRec = (nodes: MediaCategoryNode[]) => {
    nodes.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
    for (const n of nodes) sortRec(n.children)
  }
  sortRec(roots)
  return roots
}

export function findCategoryInTree(
  tree: MediaCategoryNode[],
  id: string,
): MediaCategoryNode | null {
  for (const n of tree) {
    if (n.id === id) return n
    const hit = findCategoryInTree(n.children, id)
    if (hit) return hit
  }
  return null
}
