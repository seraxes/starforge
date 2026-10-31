import { eq } from 'drizzle-orm'

import { db, DEFAULT_LAYOUT_ID, sfLayouts } from '@/core/db'

import {
  cloneDefaultLayoutDocument,
  normalizeLayoutDocument,
  parseLayoutDocumentJson,
  serializeLayoutDocument,
} from './document'
import type { LayoutDocument } from './types'

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
      if (parsed && parsed.sections.length > 0) {
        return { document: parsed, source: 'database', isFallback: false }
      }
      // Empty sections in DB → treat as empty and fall back so public chrome works.
      if (parsed && parsed.sections.length === 0) {
        return {
          document: cloneDefaultLayoutDocument(),
          source: 'default-json',
          isFallback: true,
        }
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
  const normalized = normalizeLayoutDocument(doc) ?? { version: 2 as const, sections: [] }
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
 * Seed helper: write the default layout (notice-bar → header) if no row exists.
 * Idempotent — does not overwrite an existing document.
 */
export async function ensureDefaultLayoutSeeded(): Promise<{
  created: boolean
  document: LayoutDocument
}> {
  try {
    const [row] = await db
      .select({ id: sfLayouts.id })
      .from(sfLayouts)
      .where(eq(sfLayouts.id, DEFAULT_LAYOUT_ID))
      .limit(1)

    if (row) {
      const loaded = await loadLayoutDocument()
      return { created: false, document: loaded.document }
    }
  } catch {
    // Table missing — caller should run db:core:push.
    throw new Error(
      'sf_layouts table missing — run npm run db:core:push before seeding the layout.',
    )
  }

  const document = await saveLayoutDocument(cloneDefaultLayoutDocument())
  return { created: true, document }
}
