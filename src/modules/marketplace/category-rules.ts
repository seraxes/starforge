/**
 * Pure marketplace category field validation for admin create/update.
 * Store and actions call these; unit tests hit this module without DB.
 */

export type CategoryFieldInput = {
  title?: unknown
  description?: unknown
  slug?: unknown
  parentId?: unknown
  enabled?: unknown
  sortOrder?: unknown
}

export type CategoryFieldValues = {
  title: string
  description: string
  slug: string
  parentId: string
  enabled: boolean
  sortOrder: number
}

function asTrimmed(raw: unknown): string {
  return String(raw ?? '').trim()
}

function parseSortOrder(
  raw: unknown,
  fallback: number,
): { ok: true; value: number } | { ok: false; error: string } {
  if (raw == null || raw === '') return { ok: true, value: fallback }
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isFinite(n)) return { ok: false, error: 'Sort order must be a number.' }
  return { ok: true, value: Math.max(-10000, Math.min(10000, Math.trunc(n))) }
}

function parseEnabled(raw: unknown, fallback: boolean): boolean {
  if (typeof raw === 'boolean') return raw
  if (raw == null || raw === '') return fallback
  const s = String(raw).trim().toLowerCase()
  if (s === '0' || s === 'false' || s === 'off' || s === 'no') return false
  if (s === '1' || s === 'true' || s === 'on' || s === 'yes') return true
  return fallback
}

/** Normalize slug from explicit input or title. */
export function normalizeCategorySlug(raw: unknown): string {
  return asTrimmed(raw)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

/**
 * Normalize and validate category fields.
 * Refuses an empty title. Accepts a titled enabled (or disabled) category.
 */
export function validateCategoryFields(
  input: CategoryFieldInput,
  existing?: Partial<CategoryFieldValues>,
): { ok: true; values: CategoryFieldValues } | { ok: false; error: string } {
  const title = asTrimmed(input.title !== undefined ? input.title : existing?.title).slice(
    0,
    200,
  )
  if (!title) return { ok: false, error: 'Title is required.' }

  const description = asTrimmed(
    input.description !== undefined ? input.description : existing?.description,
  ).slice(0, 4000)

  const slugSource =
    input.slug !== undefined && asTrimmed(input.slug)
      ? input.slug
      : existing?.slug || title
  const slug = normalizeCategorySlug(slugSource) || normalizeCategorySlug(title) || 'category'

  const sortParsed = parseSortOrder(
    input.sortOrder !== undefined ? input.sortOrder : existing?.sortOrder,
    existing?.sortOrder ?? 0,
  )
  if (!sortParsed.ok) return sortParsed

  const enabled =
    input.enabled === undefined
      ? existing?.enabled !== false
      : parseEnabled(input.enabled, existing?.enabled !== false)

  const parentId = asTrimmed(
    input.parentId !== undefined ? input.parentId : existing?.parentId,
  )

  return {
    ok: true,
    values: {
      title,
      description,
      slug,
      parentId,
      enabled,
      sortOrder: sortParsed.value,
    },
  }
}
