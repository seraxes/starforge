/**
 * Pure package / placement field validation for admin create/update.
 * Store and actions call these; unit tests hit this module without DB.
 */

export type PackageFieldInput = {
  title?: unknown
  description?: unknown
  price?: unknown
  creditGrant?: unknown
  active?: unknown
  sortOrder?: unknown
}

export type PackageFieldValues = {
  title: string
  description: string
  price: number
  creditGrant: number
  active: boolean
  sortOrder: number
}

export type PlacementFieldInput = {
  label?: unknown
  key?: unknown
  enabled?: unknown
}

export type PlacementFieldValues = {
  label: string
  key: string
  enabled: boolean
}

function asTrimmed(raw: unknown): string {
  return String(raw ?? '').trim()
}

/**
 * Parse a non-negative major-unit price.
 * Empty → 0. Negative or non-finite → error (do not coerce).
 */
export function parsePackagePrice(
  raw: unknown,
): { ok: true; value: number } | { ok: false; error: string } {
  if (raw == null || raw === '') return { ok: true, value: 0 }
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isFinite(n)) return { ok: false, error: 'Price must be a number.' }
  if (n < 0) return { ok: false, error: 'Price cannot be negative.' }
  return { ok: true, value: Math.floor(n) }
}

function parseNonNegInt(
  raw: unknown,
  fallback: number,
  label: string,
): { ok: true; value: number } | { ok: false; error: string } {
  if (raw == null || raw === '') return { ok: true, value: fallback }
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isFinite(n)) return { ok: false, error: `${label} must be a number.` }
  if (n < 0) return { ok: false, error: `${label} cannot be negative.` }
  return { ok: true, value: Math.floor(n) }
}

/** Normalize and validate package fields. Refuses empty title and negative price. */
export function validatePackageFields(
  input: PackageFieldInput,
  existing?: Partial<PackageFieldValues>,
): { ok: true; values: PackageFieldValues } | { ok: false; error: string } {
  const title = asTrimmed(input.title !== undefined ? input.title : existing?.title)
  if (!title) return { ok: false, error: 'Title is required.' }

  const priceParsed = parsePackagePrice(
    input.price !== undefined ? input.price : existing?.price ?? 0,
  )
  if (!priceParsed.ok) return priceParsed

  const creditParsed = parseNonNegInt(
    input.creditGrant !== undefined ? input.creditGrant : existing?.creditGrant,
    existing?.creditGrant ?? 0,
    'Credit grant',
  )
  if (!creditParsed.ok) return creditParsed

  const sortParsed = parseNonNegInt(
    input.sortOrder !== undefined ? input.sortOrder : existing?.sortOrder,
    existing?.sortOrder ?? 0,
    'Sort order',
  )
  if (!sortParsed.ok) return sortParsed

  const active =
    input.active === undefined
      ? existing?.active !== false
      : input.active === true || input.active === '1' || input.active === 1

  return {
    ok: true,
    values: {
      title,
      description: asTrimmed(
        input.description !== undefined ? input.description : existing?.description,
      ),
      price: priceParsed.value,
      creditGrant: creditParsed.value,
      active,
      sortOrder: sortParsed.value,
    },
  }
}

const PLACEMENT_KEY_RE = /^[a-z][a-z0-9_]{1,63}$/

/** Normalize and validate placement fields. Refuses empty label/key; key must be slug-like. */
export function validatePlacementFields(
  input: PlacementFieldInput,
  existing?: Partial<PlacementFieldValues>,
): { ok: true; values: PlacementFieldValues } | { ok: false; error: string } {
  const label = asTrimmed(input.label !== undefined ? input.label : existing?.label)
  if (!label) return { ok: false, error: 'Label is required.' }

  const key = asTrimmed(input.key !== undefined ? input.key : existing?.key).toLowerCase()
  if (!key) return { ok: false, error: 'Key is required.' }
  if (!PLACEMENT_KEY_RE.test(key)) {
    return {
      ok: false,
      error: 'Key must be lowercase letters, digits, or underscore (e.g. social_feed).',
    }
  }

  const enabled =
    input.enabled === undefined
      ? existing?.enabled !== false
      : input.enabled === true || input.enabled === '1' || input.enabled === 1

  return { ok: true, values: { label, key, enabled } }
}
