import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'

import { MEDIA_CATEGORY_MAX_DEPTH, slugifyCategoryName } from '@/core/media/categories'

/**
 * Shared nested Categories taxonomy for Media Manager (Phase 2).
 * Hierarchy = file-manager folders; Tags stay flat labels.
 * Not a second media store — Media.category points here.
 */
const ensureSlugAndDepth: CollectionBeforeChangeHook = async ({ data, originalDoc, req, operation }) => {
  const next = { ...(data || {}) }
  const title =
    typeof next.title === 'string' && next.title.trim()
      ? next.title.trim()
      : typeof originalDoc?.title === 'string'
        ? originalDoc.title
        : ''
  if (title && (!next.slug || typeof next.slug !== 'string' || !String(next.slug).trim())) {
    next.slug = slugifyCategoryName(title)
  }

  const parentRaw = next.parent ?? originalDoc?.parent ?? null
  const parentId =
    parentRaw == null
      ? null
      : typeof parentRaw === 'object' && parentRaw !== null && 'id' in parentRaw
        ? Number((parentRaw as { id: number | string }).id)
        : Number(parentRaw)

  let depth = 0
  if (parentId != null && Number.isFinite(parentId) && parentId > 0) {
    const selfId =
      operation === 'update' && originalDoc?.id != null ? Number(originalDoc.id) : null
    let walk: number | null = parentId
    const seen = new Set<number>()
    while (walk != null) {
      if (selfId != null && walk === selfId) {
        throw new Error('Category parent cannot create a cycle.')
      }
      if (seen.has(walk)) {
        throw new Error('Category parent cycle detected.')
      }
      seen.add(walk)
      depth += 1
      if (depth > MEDIA_CATEGORY_MAX_DEPTH) {
        throw new Error(`Category depth cannot exceed ${MEDIA_CATEGORY_MAX_DEPTH}.`)
      }
      const parentDoc: { parent?: unknown } = await req.payload.findByID({
        collection: 'categories',
        id: walk,
        depth: 0,
        overrideAccess: true,
      })
      const p = parentDoc.parent
      walk =
        p == null
          ? null
          : typeof p === 'object' && p !== null && 'id' in p
            ? Number((p as { id: number | string }).id)
            : Number(p)
      if (walk == null || !Number.isFinite(walk)) walk = null
    }
  }
  next.depth = depth

  // Materialize breadcrumb path from ancestor titles (root → leaf).
  const segments: string[] = []
  if (parentId != null && Number.isFinite(parentId) && parentId > 0) {
    let walk: number | null = parentId
    const titles: string[] = []
    while (walk != null) {
      const doc: { title?: unknown; parent?: unknown } = await req.payload.findByID({
        collection: 'categories',
        id: walk,
        depth: 0,
        overrideAccess: true,
      })
      if (typeof doc.title === 'string' && doc.title.trim()) {
        titles.unshift(doc.title.trim())
      }
      const p = doc.parent
      walk =
        p == null
          ? null
          : typeof p === 'object' && p !== null && 'id' in p
            ? Number((p as { id: number | string }).id)
            : Number(p)
      if (walk == null || !Number.isFinite(walk)) walk = null
    }
    segments.push(...titles)
  }
  if (title) segments.push(title)
  next.path = segments.length ? segments.join(' / ') : title || ''

  return next
}

export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'parent', 'path', 'updatedAt'],
    description:
      'Nested media folders (shared taxonomy). Browse in Core Media library — not a second blob store.',
    group: 'Content',
  },
  access: {
    read: () => true,
  },
  hooks: {
    beforeChange: [ensureSlugAndDepth],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        position: 'sidebar',
        description: 'Stable key (legacy flat folders seed as general, logos, …).',
      },
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'categories',
      admin: {
        position: 'sidebar',
        description: 'Leave empty for a root folder. Max nested depth 6.',
      },
    },
    {
      name: 'path',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Derived breadcrumb (root → leaf).',
      },
    },
    {
      name: 'depth',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: '0 = root. Enforced max 6.',
      },
    },
  ],
}
