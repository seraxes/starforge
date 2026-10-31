import { eq } from 'drizzle-orm'

import { db, DEFAULT_LAYOUT_ID, sfLayouts } from '@/core/db'

import {
  cloneDefaultLayoutDocument,
  normalizeLayoutDocument,
  parseLayoutDocumentJson,
  serializeLayoutDocument,
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
}

/**
 * Read the active layout document.
 * Prefers `sf_layouts.default`; falls back to `default-layout.json` when empty
 * or when the table is missing (before `db:core:push`).
 */
export async function loadLayoutDocument(): Promise<LayoutLoadResult> {
  try {
    const [row] = await db
      .select({ document: sfLayouts.document })
      .from(sfLayouts)
      .where(eq(sfLayouts.id, DEFAULT_LAYOUT_ID))
      .limit(1)

    if (row?.document?.trim()) {
      const parsed = parseLayoutDocumentJson(row.document)
      if (isUsableDocument(parsed)) {
        return { document: parsed, source: 'database', isFallback: false }
      }
      // Empty / unreadable DB row → fall back so public chrome works.
      return {
        document: cloneDefaultLayoutDocument(),
        source: 'default-json',
        isFallback: true,
      }
    }
  } catch {
    // Table may not exist yet — fall through to JSON default.
  }

  return {
    document: cloneDefaultLayoutDocument(),
    source: 'default-json',
    isFallback: true,
  }
}

/** Persist the layout document (upsert the `default` row). */
export async function saveLayoutDocument(doc: LayoutDocument): Promise<LayoutDocument> {
  const normalized = normalizeLayoutDocument(doc) ?? { version: 3 as const, sections: [] }
  const json = serializeLayoutDocument(normalized)
  const now = new Date()

  const [existing] = await db
    .select({ id: sfLayouts.id })
    .from(sfLayouts)
    .where(eq(sfLayouts.id, DEFAULT_LAYOUT_ID))
    .limit(1)

  if (existing) {
    await db
      .update(sfLayouts)
      .set({ document: json, updatedAt: now })
      .where(eq(sfLayouts.id, DEFAULT_LAYOUT_ID))
  } else {
    await db.insert(sfLayouts).values({
      id: DEFAULT_LAYOUT_ID,
      document: json,
      createdAt: now,
      updatedAt: now,
    })
  }

  return normalized
}

/**
 * Seed helper: write the default v3 layout if no row exists.
 * If an older v1/v2 document is present, upgrades and re-saves it (preserves assignments).
 */
export async function ensureDefaultLayoutSeeded(): Promise<{
  created: boolean
  upgraded?: boolean
  document: LayoutDocument
}> {
  try {
    const [row] = await db
      .select({ id: sfLayouts.id, document: sfLayouts.document })
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
      if (isUsableDocument(parsed) && rawVersion === 3) {
        return { created: false, document: parsed }
      }
      if (isUsableDocument(parsed)) {
        const document = await saveLayoutDocument(parsed)
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

  const document = await saveLayoutDocument(cloneDefaultLayoutDocument())
  return { created: true, document }
}
