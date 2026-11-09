import { asc, eq } from 'drizzle-orm'

import { invalidateLayout } from '@/core/content/revalidate'
import { db, DEFAULT_LAYOUT_ID, sfLayouts } from '@/core/db'
import { ensureLayoutSkinIdColumn } from '@/core/db/ensure-layout-skin-id'

import {
  cloneDefaultLayoutDocument,
  normalizeLayoutDocument,
  parseLayoutDocumentJson,
  serializeLayoutDocument,
  slugifyLayoutId,
} from './document'
import type { LayoutDocument } from './types'

function isUsableDocument(doc: LayoutDocument | null | undefined): doc is LayoutDocument {
  return Boolean(doc && doc.version === 3 && Array.isArray(doc.sections) && doc.sections.length > 0)
}

export type LayoutLoadSource = 'database' | 'default-json'

export type LayoutLoadResult = {
  document: LayoutDocument
  source: LayoutLoadSource
  /** True when the DB row was missing/empty and the checked-in default was used. */
  isFallback: boolean
  layoutId: string
  label: string
}

/** Metadata for one outline row in `sf_layouts`. */
export type LayoutOutlineMeta = {
  id: string
  label: string
  /** Owning skin id (`sf_layouts.skin_id`), null = Core / unassigned. */
  skinId: string | null
  createdAt: Date
  updatedAt: Date
}

const DEFAULT_OUTLINE_LABEL = 'Core default'

function displayLabelForId(id: string, label: string | null | undefined): string {
  const trimmed = typeof label === 'string' ? label.trim() : ''
  if (trimmed) return trimmed
  if (id === DEFAULT_LAYOUT_ID) return DEFAULT_OUTLINE_LABEL
  return id
}

function resolveLayoutId(layoutId?: string | null): string {
  const id = typeof layoutId === 'string' ? layoutId.trim() : ''
  return id || DEFAULT_LAYOUT_ID
}

/**
 * Read a layout document by outline id (default: site `default`).
 * Prefers `sf_layouts`; falls back to `default-layout.json` when empty
 * or when the table is missing (before `db:core:push`).
 * Unknown ids fall back to the `default` row, then the JSON seed.
 */
export async function loadLayoutDocument(
  layoutId: string = DEFAULT_LAYOUT_ID,
): Promise<LayoutLoadResult> {
  const id = resolveLayoutId(layoutId)

  const tryRow = async (rowId: string): Promise<LayoutLoadResult | null> => {
    try {
      const [row] = await db
        .select({
          id: sfLayouts.id,
          label: sfLayouts.label,
          document: sfLayouts.document,
        })
        .from(sfLayouts)
        .where(eq(sfLayouts.id, rowId))
        .limit(1)

      if (row?.document?.trim()) {
        const parsed = parseLayoutDocumentJson(row.document)
        if (isUsableDocument(parsed)) {
          return {
            document: parsed,
            source: 'database',
            isFallback: rowId !== id,
            layoutId: row.id,
            label: displayLabelForId(row.id, row.label),
          }
        }
      }
    } catch {
      // Table may not exist yet.
    }
    return null
  }

  const primary = await tryRow(id)
  if (primary) return primary

  if (id !== DEFAULT_LAYOUT_ID) {
    const fallback = await tryRow(DEFAULT_LAYOUT_ID)
    if (fallback) {
      return { ...fallback, isFallback: true }
    }
  }

  return {
    document: cloneDefaultLayoutDocument(),
    source: 'default-json',
    isFallback: true,
    layoutId: id,
    label: displayLabelForId(id, null),
  }
}

/** Persist a layout document (upsert by outline id). Preserves existing label / skinId. */
export async function saveLayoutDocument(
  doc: LayoutDocument,
  layoutId: string = DEFAULT_LAYOUT_ID,
  options?: { label?: string; skinId?: string | null },
): Promise<LayoutDocument> {
  await ensureLayoutSkinIdColumn()
  const id = resolveLayoutId(layoutId)
  const normalized = normalizeLayoutDocument(doc) ?? { version: 3 as const, sections: [] }
  const json = serializeLayoutDocument(normalized)
  const now = new Date()

  const [existing] = await db
    .select({ id: sfLayouts.id, label: sfLayouts.label, skinId: sfLayouts.skinId })
    .from(sfLayouts)
    .where(eq(sfLayouts.id, id))
    .limit(1)

  const label =
    (typeof options?.label === 'string' && options.label.trim()) ||
    existing?.label ||
    displayLabelForId(id, null)

  const skinId =
    options?.skinId !== undefined
      ? options.skinId && String(options.skinId).trim()
        ? String(options.skinId).trim()
        : null
      : existing?.skinId ?? null

  if (existing) {
    await db
      .update(sfLayouts)
      .set({
        document: json,
        ...(options?.label !== undefined ? { label } : {}),
        ...(options?.skinId !== undefined ? { skinId } : {}),
        updatedAt: now,
      })
      .where(eq(sfLayouts.id, id))
  } else {
    await db.insert(sfLayouts).values({
      id,
      label,
      document: json,
      skinId,
      createdAt: now,
      updatedAt: now,
    })
  }

  await invalidateLayout(id)
  return normalized
}

/** Patch outline metadata without rewriting the document JSON. */
export async function patchLayoutOutlineMeta(
  layoutId: string,
  patch: { label?: string; skinId?: string | null },
): Promise<{ outline: LayoutOutlineMeta } | { error: string }> {
  const id = resolveLayoutId(layoutId)
  try {
    await ensureLayoutSkinIdColumn()
    const [existing] = await db
      .select({
        id: sfLayouts.id,
        label: sfLayouts.label,
        skinId: sfLayouts.skinId,
        createdAt: sfLayouts.createdAt,
        updatedAt: sfLayouts.updatedAt,
      })
      .from(sfLayouts)
      .where(eq(sfLayouts.id, id))
      .limit(1)
    if (!existing) return { error: `Outline “${id}” was not found.` }

    const nextLabel =
      typeof patch.label === 'string' && patch.label.trim()
        ? patch.label.trim()
        : existing.label
    const nextSkinId =
      patch.skinId !== undefined
        ? patch.skinId && String(patch.skinId).trim()
          ? String(patch.skinId).trim()
          : null
        : existing.skinId

    await db
      .update(sfLayouts)
      .set({
        label: nextLabel,
        skinId: nextSkinId,
        updatedAt: new Date(),
      })
      .where(eq(sfLayouts.id, id))

    return {
      outline: {
        id: existing.id,
        label: displayLabelForId(existing.id, nextLabel),
        skinId: nextSkinId,
        createdAt: existing.createdAt,
        updatedAt: new Date(),
      },
    }
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : 'Could not update outline metadata.',
    }
  }
}

/** List all layout outlines (named layouts) for Outlines manager + Layouts chrome. */
export async function listLayoutOutlines(): Promise<LayoutOutlineMeta[]> {
  try {
    await ensureLayoutSkinIdColumn()
    const rows = await db
      .select({
        id: sfLayouts.id,
        label: sfLayouts.label,
        skinId: sfLayouts.skinId,
        createdAt: sfLayouts.createdAt,
        updatedAt: sfLayouts.updatedAt,
      })
      .from(sfLayouts)
      .orderBy(asc(sfLayouts.label), asc(sfLayouts.id))

    if (rows.length === 0) {
      return [
        {
          id: DEFAULT_LAYOUT_ID,
          label: DEFAULT_OUTLINE_LABEL,
          skinId: null,
          createdAt: new Date(0),
          updatedAt: new Date(0),
        },
      ]
    }

    return rows.map((row) => ({
      id: row.id,
      label: displayLabelForId(row.id, row.label),
      skinId: row.skinId?.trim() || null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }))
  } catch {
    return [
      {
        id: DEFAULT_LAYOUT_ID,
        label: DEFAULT_OUTLINE_LABEL,
        skinId: null,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
    ]
  }
}

export async function getLayoutOutline(
  layoutId: string,
): Promise<LayoutOutlineMeta | null> {
  const id = resolveLayoutId(layoutId)
  try {
    await ensureLayoutSkinIdColumn()
    const [row] = await db
      .select({
        id: sfLayouts.id,
        label: sfLayouts.label,
        skinId: sfLayouts.skinId,
        createdAt: sfLayouts.createdAt,
        updatedAt: sfLayouts.updatedAt,
      })
      .from(sfLayouts)
      .where(eq(sfLayouts.id, id))
      .limit(1)
    if (!row) return null
    return {
      id: row.id,
      label: displayLabelForId(row.id, row.label),
      skinId: row.skinId?.trim() || null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  } catch {
    return null
  }
}

function uniqueOutlineId(base: string, existing: Set<string>): string {
  const candidate = slugifyLayoutId(base)
  if (!existing.has(candidate)) return candidate
  let n = 2
  while (existing.has(`${candidate}-${n}`)) n += 1
  return `${candidate}-${n}`
}

/**
 * Create a new outline under a skin.
 *
 * - **Inherit** (`asInheritingChild` + `inheritFromId`): thin child stub; live link to parent.
 * - **Copy** (`copyFromId`, not inheriting): full snapshot of the source’s **resolved**
 *   layout (parent merge applied), no further inherit link.
 */
export async function createLayoutOutline(input: {
  label: string
  id?: string
  /** Source outline to snapshot when not inheriting. */
  copyFromId?: string
  /** Parent outline id for live inherit. */
  inheritFromId?: string
  /** True = inherit stub; false = standalone copy (default true when inheritFrom set). */
  asInheritingChild?: boolean
  /** Owning skin — required for skin-pack children (Outlines Skin badge). */
  skinId?: string | null
}): Promise<{ outline: LayoutOutlineMeta } | { error: string }> {
  const label = input.label.trim()
  if (!label) return { error: 'Outline name is required.' }

  const existing = await listLayoutOutlines()
  const ids = new Set(existing.map((o) => o.id))
  const skinId =
    typeof input.skinId === 'string' && input.skinId.trim() ? input.skinId.trim() : null
  // Prefer skin-prefixed ids so children stay clearly under the pack.
  const idBase =
    input.id?.trim() ||
    (skinId ? `${skinId}-${slugifyLayoutId(label)}` : slugifyLayoutId(label))
  const id = uniqueOutlineId(idBase, ids)

  const inheritFrom = input.inheritFromId?.trim() || ''
  const copyFrom = input.copyFromId?.trim() || ''
  const asChild = Boolean(inheritFrom) && input.asInheritingChild !== false

  // Dynamic import avoids circular deps (inherit.ts → layout-store).
  const { resolveLayoutInheritance } = await import('./inherit')

  let document: LayoutDocument

  if (asChild) {
    if (inheritFrom === id) {
      return { error: 'An outline cannot inherit from itself.' }
    }
    const parent = await loadLayoutDocument(inheritFrom)
    if (parent.layoutId !== inheritFrom && inheritFrom !== DEFAULT_LAYOUT_ID) {
      return { error: `Parent outline “${inheritFrom}” was not found.` }
    }
    const parentResolved = await resolveLayoutInheritance(parent.layoutId, parent.document)
    document = {
      version: 3,
      inheritFrom,
      sections: [],
      ...(parentResolved.styles ? { styles: structuredClone(parentResolved.styles) } : {}),
    }
  } else if (copyFrom) {
    const source = await loadLayoutDocument(copyFrom)
    if (source.layoutId !== copyFrom && copyFrom !== DEFAULT_LAYOUT_ID) {
      return { error: `Source outline “${copyFrom}” was not found.` }
    }
    // Snapshot the painted layout so copying a child still gets parent sections.
    const resolved = await resolveLayoutInheritance(source.layoutId, source.document)
    document = structuredClone(resolved)
    delete document.inheritFrom
    delete document.omitSectionIds
  } else {
    document = cloneDefaultLayoutDocument()
    delete document.inheritFrom
    delete document.omitSectionIds
  }

  try {
    await saveLayoutDocument(document, id, { label, skinId })
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : 'Could not create the outline.',
    }
  }

  const outline = await getLayoutOutline(id)
  if (!outline) return { error: 'Outline created but could not be reloaded.' }
  return { outline }
}

/** Rename an outline’s display label (id stays stable for Page Settings). */
export async function renameLayoutOutline(
  layoutId: string,
  label: string,
): Promise<{ outline: LayoutOutlineMeta } | { error: string }> {
  const id = resolveLayoutId(layoutId)
  const nextLabel = label.trim()
  if (!nextLabel) return { error: 'Outline name is required.' }

  try {
    const [existing] = await db
      .select({ id: sfLayouts.id })
      .from(sfLayouts)
      .where(eq(sfLayouts.id, id))
      .limit(1)
    if (!existing) return { error: `Outline “${id}” was not found.` }

    await db
      .update(sfLayouts)
      .set({ label: nextLabel, updatedAt: new Date() })
      .where(eq(sfLayouts.id, id))
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : 'Could not rename the outline.',
    }
  }

  const outline = await getLayoutOutline(id)
  if (!outline) return { error: 'Outline renamed but could not be reloaded.' }
  return { outline }
}

/**
 * Duplicate an outline into a new id + label.
 * Default: inheriting child of the skin Base (or source when source is Base),
 * same `skinId` as the source / active skin.
 */
export async function duplicateLayoutOutline(
  sourceId: string,
  label: string,
  requestedId?: string,
  options?: {
    asInheritingChild?: boolean
    /** Parent for inheritFrom — defaults to skin Base when duplicating Base itself. */
    inheritFromId?: string
    skinId?: string | null
    /** Skin Base outline id — used when duplicating the Base so children inherit Base. */
    skinBaseOutlineId?: string | null
  },
): Promise<{ outline: LayoutOutlineMeta } | { error: string }> {
  const source = resolveLayoutId(sourceId)
  const nextLabel = label.trim()
  if (!nextLabel) return { error: 'Outline name is required.' }

  const loaded = await loadLayoutDocument(source)
  if (loaded.source !== 'database' || (loaded.isFallback && loaded.layoutId !== source)) {
    // Allow duplicating default even if only JSON fallback exists.
    if (source !== DEFAULT_LAYOUT_ID && loaded.layoutId !== source) {
      return { error: `Source outline “${source}” was not found.` }
    }
  }

  const sourceMeta = await getLayoutOutline(source)
  const skinId =
    (typeof options?.skinId === 'string' && options.skinId.trim()
      ? options.skinId.trim()
      : null) ||
    sourceMeta?.skinId ||
    null

  const existing = await listLayoutOutlines()
  const ids = new Set(existing.map((o) => o.id))
  const idBase =
    requestedId?.trim() ||
    (skinId ? `${skinId}-${slugifyLayoutId(nextLabel)}` : slugifyLayoutId(nextLabel))
  const id = uniqueOutlineId(idBase, ids)

  const asChild = options?.asInheritingChild !== false
  // Inherit = live child of the source itself. Copy = resolved snapshot, no link.
  const inheritFrom =
    (typeof options?.inheritFromId === 'string' && options.inheritFromId.trim()
      ? options.inheritFromId.trim()
      : '') || (asChild ? source : '')

  const { resolveLayoutInheritance } = await import('./inherit')

  let document: LayoutDocument
  if (asChild && inheritFrom) {
    const parentResolved = await resolveLayoutInheritance(loaded.layoutId, loaded.document)
    document = {
      version: 3,
      inheritFrom,
      sections: [],
      ...(parentResolved.styles ? { styles: structuredClone(parentResolved.styles) } : {}),
    }
  } else {
    const resolved = await resolveLayoutInheritance(loaded.layoutId, loaded.document)
    document = structuredClone(resolved)
    delete document.inheritFrom
    delete document.omitSectionIds
  }

  try {
    await saveLayoutDocument(document, id, { label: nextLabel, skinId })
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : 'Could not duplicate the outline.',
    }
  }

  const outline = await getLayoutOutline(id)
  if (!outline) return { error: 'Outline duplicated but could not be reloaded.' }
  return { outline }
}

/**
 * Set or clear document-level `inheritFrom` on an outline (unlocks Layout/Styles inherit UI).
 * Does not wipe local sections — only the parent pointer.
 */
export async function setLayoutInheritFrom(
  layoutId: string,
  inheritFromId: string | null,
): Promise<{ outline: LayoutOutlineMeta } | { error: string }> {
  const id = resolveLayoutId(layoutId)
  const parentId = typeof inheritFromId === 'string' ? inheritFromId.trim() : ''

  if (parentId === id) {
    return { error: 'An outline cannot inherit from itself.' }
  }
  if (parentId) {
    const parent = await loadLayoutDocument(parentId)
    if (parent.layoutId !== parentId && parentId !== DEFAULT_LAYOUT_ID) {
      return { error: `Parent outline “${parentId}” was not found.` }
    }
  }

  const loaded = await loadLayoutDocument(id)
  if (loaded.layoutId !== id && id !== DEFAULT_LAYOUT_ID) {
    return { error: `Outline “${id}” was not found.` }
  }

  const document = structuredClone(loaded.document)
  if (parentId) document.inheritFrom = parentId
  else delete document.inheritFrom

  try {
    await saveLayoutDocument(document, id, { label: loaded.label })
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : 'Could not update outline inheritance.',
    }
  }

  const outline = await getLayoutOutline(id)
  if (!outline) return { error: 'Outline updated but could not be reloaded.' }
  return { outline }
}

/** Delete an outline. Core `default` cannot be deleted. */
export async function deleteLayoutOutline(
  layoutId: string,
): Promise<{ ok: true } | { error: string }> {
  const id = resolveLayoutId(layoutId)
  if (id === DEFAULT_LAYOUT_ID) {
    return { error: 'The Core default outline cannot be deleted.' }
  }

  try {
    const result = await db.delete(sfLayouts).where(eq(sfLayouts.id, id)).returning({
      id: sfLayouts.id,
    })
    if (result.length === 0) return { error: `Outline “${id}” was not found.` }
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : 'Could not delete the outline.',
    }
  }

  await invalidateLayout(id)
  try {
    const { deleteOutlinePageChrome } = await import('@/core/page-settings/store')
    await deleteOutlinePageChrome(id)
  } catch {
    // Page Settings table may be unavailable — outline delete still succeeded.
  }
  return { ok: true }
}

/**
 * Seed helper: write the default v3 layout if no row exists.
 * If an older v1/v2 document is present, upgrades and re-saves it (preserves assignments).
 * Ensures the default row has a display label.
 */
export async function ensureDefaultLayoutSeeded(): Promise<{
  created: boolean
  upgraded?: boolean
  document: LayoutDocument
}> {
  try {
    const [row] = await db
      .select({ id: sfLayouts.id, label: sfLayouts.label, document: sfLayouts.document })
      .from(sfLayouts)
      .where(eq(sfLayouts.id, DEFAULT_LAYOUT_ID))
      .limit(1)

    if (row) {
      let rawVersion = 0
      try {
        rawVersion = Number(JSON.parse(row.document)?.version ?? 0)
      } catch {
        rawVersion = 0
      }
      const parsed = parseLayoutDocumentJson(row.document)
      if (!row.label?.trim() || row.label === 'Untitled') {
        await db
          .update(sfLayouts)
          .set({ label: DEFAULT_OUTLINE_LABEL, updatedAt: new Date() })
          .where(eq(sfLayouts.id, DEFAULT_LAYOUT_ID))
      }
      if (isUsableDocument(parsed) && rawVersion === 3) {
        return { created: false, document: parsed }
      }
      if (isUsableDocument(parsed)) {
        const document = await saveLayoutDocument(parsed, DEFAULT_LAYOUT_ID, {
          label: DEFAULT_OUTLINE_LABEL,
        })
        return { created: false, upgraded: true, document }
      }
      // Unreadable — leave row alone and serve default in memory.
      return { created: false, document: cloneDefaultLayoutDocument() }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('sf_layouts')) throw error
    throw new Error(
      'sf_layouts table missing — run npm run db:core:push before seeding the layout.',
    )
  }

  const document = await saveLayoutDocument(cloneDefaultLayoutDocument(), DEFAULT_LAYOUT_ID, {
    label: DEFAULT_OUTLINE_LABEL,
  })
  return { created: true, document }
}

/** True when the outline id is the protected Base Outline. */
export function isDefaultLayoutOutline(layoutId: string): boolean {
  return resolveLayoutId(layoutId) === DEFAULT_LAYOUT_ID
}

