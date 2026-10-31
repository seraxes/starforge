import { asc, eq } from 'drizzle-orm'

import { db, DEFAULT_LAYOUT_ID, sfLayouts } from '@/core/db'

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
  createdAt: Date
  updatedAt: Date
}

const DEFAULT_OUTLINE_LABEL = 'Default'

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

/** Persist a layout document (upsert by outline id). Preserves existing label. */
export async function saveLayoutDocument(
  doc: LayoutDocument,
  layoutId: string = DEFAULT_LAYOUT_ID,
  options?: { label?: string },
): Promise<LayoutDocument> {
  const id = resolveLayoutId(layoutId)
  const normalized = normalizeLayoutDocument(doc) ?? { version: 3 as const, sections: [] }
  const json = serializeLayoutDocument(normalized)
  const now = new Date()

  const [existing] = await db
    .select({ id: sfLayouts.id, label: sfLayouts.label })
    .from(sfLayouts)
    .where(eq(sfLayouts.id, id))
    .limit(1)

  const label =
    (typeof options?.label === 'string' && options.label.trim()) ||
    existing?.label ||
    displayLabelForId(id, null)

  if (existing) {
    await db
      .update(sfLayouts)
      .set({
        document: json,
        ...(options?.label !== undefined ? { label } : {}),
        updatedAt: now,
      })
      .where(eq(sfLayouts.id, id))
  } else {
    await db.insert(sfLayouts).values({
      id,
      label,
      document: json,
      createdAt: now,
      updatedAt: now,
    })
  }

  return normalized
}

/** List all layout outlines (named layouts) for Outlines manager + Page Settings. */
export async function listLayoutOutlines(): Promise<LayoutOutlineMeta[]> {
  try {
    const rows = await db
      .select({
        id: sfLayouts.id,
        label: sfLayouts.label,
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
          createdAt: new Date(0),
          updatedAt: new Date(0),
        },
      ]
    }

    return rows.map((row) => ({
      id: row.id,
      label: displayLabelForId(row.id, row.label),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }))
  } catch {
    return [
      {
        id: DEFAULT_LAYOUT_ID,
        label: DEFAULT_OUTLINE_LABEL,
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
    const [row] = await db
      .select({
        id: sfLayouts.id,
        label: sfLayouts.label,
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
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  } catch {
    return null
  }
}

function uniqueOutlineId(base: string, existing: Set<string>): string {
  let candidate = slugifyLayoutId(base)
  if (!existing.has(candidate)) return candidate
  let n = 2
  while (existing.has(`${candidate}-${n}`)) n += 1
  return `${candidate}-${n}`
}

/**
 * Create a new outline. Optionally copy document from another outline
 * (default: clone the checked-in default layout JSON).
 */
export async function createLayoutOutline(input: {
  label: string
  id?: string
  copyFromId?: string
}): Promise<{ outline: LayoutOutlineMeta } | { error: string }> {
  const label = input.label.trim()
  if (!label) return { error: 'Outline name is required.' }

  const existing = await listLayoutOutlines()
  const ids = new Set(existing.map((o) => o.id))
  const id = uniqueOutlineId(input.id?.trim() || label, ids)

  let document = cloneDefaultLayoutDocument()
  const copyFrom = input.copyFromId?.trim()
  if (copyFrom) {
    const source = await loadLayoutDocument(copyFrom)
    if (source.source === 'database' && !source.isFallback) {
      document = structuredClone(source.document)
    } else if (copyFrom === DEFAULT_LAYOUT_ID) {
      document = cloneDefaultLayoutDocument()
    } else {
      return { error: `Source outline “${copyFrom}” was not found.` }
    }
  }

  try {
    await saveLayoutDocument(document, id, { label })
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

/** Duplicate an outline into a new id + label. */
export async function duplicateLayoutOutline(
  sourceId: string,
  label: string,
  requestedId?: string,
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

  const existing = await listLayoutOutlines()
  const ids = new Set(existing.map((o) => o.id))
  const id = uniqueOutlineId(requestedId?.trim() || nextLabel, ids)

  try {
    await saveLayoutDocument(structuredClone(loaded.document), id, { label: nextLabel })
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

/** Delete an outline. The `default` Base Outline cannot be deleted. */
export async function deleteLayoutOutline(
  layoutId: string,
): Promise<{ ok: true } | { error: string }> {
  const id = resolveLayoutId(layoutId)
  if (id === DEFAULT_LAYOUT_ID) {
    return { error: 'The Default (Base) outline cannot be deleted.' }
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

