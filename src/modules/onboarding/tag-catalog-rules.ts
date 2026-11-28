/**
 * Pure staff tag catalog + follow-up tag id rules.
 * Store / actions call these; unit tests hit this module without DB.
 *
 * A tag marks a person. It does not move the person’s status.
 */

function asTrimmed(raw: unknown): string {
  return String(raw ?? '').trim()
}

function asBool(raw: unknown, fallback = false): boolean {
  if (typeof raw === 'boolean') return raw
  if (raw == null || raw === '') return fallback
  const s = String(raw).trim().toLowerCase()
  if (s === '1' || s === 'true' || s === 'on' || s === 'yes') return true
  if (s === '0' || s === 'false' || s === 'off' || s === 'no') return false
  return fallback
}

export type TagFieldInput = {
  label?: unknown
  color?: unknown
  todo?: unknown
  fade?: unknown
  sortOrder?: unknown
}

export type TagFieldValues = {
  label: string
  color: string
  todo: boolean
  fade: boolean
  sortOrder: number
}

/** Example seed rows — editable; not a fixed product set. */
export const SEEDED_ONBOARDING_TAGS: ReadonlyArray<{
  id: string
  label: string
  color: string
  todo: boolean
  fade: boolean
  sortOrder: number
}> = [
  { id: 'tag_waiting', label: 'Waiting', color: '#2563eb', todo: false, fade: false, sortOrder: 10 },
  { id: 'tag_on_hold', label: 'On hold', color: '#ea580c', todo: false, fade: false, sortOrder: 20 },
  {
    id: 'tag_action_required',
    label: 'Action required',
    color: '#dc2626',
    todo: true,
    fade: false,
    sortOrder: 30,
  },
  {
    id: 'tag_no_response',
    label: 'No response',
    color: '#ca8a04',
    todo: false,
    fade: false,
    sortOrder: 40,
  },
]

/**
 * Tag catalog fields. Empty label is refused.
 */
export function validateTagFields(
  input: TagFieldInput,
  existing?: Partial<TagFieldValues>,
): { ok: true; values: TagFieldValues } | { ok: false; error: string } {
  const label = asTrimmed(input.label !== undefined ? input.label : existing?.label)
  if (!label) return { ok: false, error: 'Tag label is required.' }

  const color = asTrimmed(
    input.color !== undefined ? input.color : (existing?.color ?? ''),
  )

  const todo =
    input.todo !== undefined ? asBool(input.todo, false) : Boolean(existing?.todo ?? false)
  const fade =
    input.fade !== undefined ? asBool(input.fade, false) : Boolean(existing?.fade ?? false)

  let sortOrder = existing?.sortOrder ?? 0
  if (input.sortOrder !== undefined && input.sortOrder !== null && input.sortOrder !== '') {
    const n =
      typeof input.sortOrder === 'number'
        ? input.sortOrder
        : Number(String(input.sortOrder).trim())
    if (!Number.isFinite(n)) return { ok: false, error: 'Sort order must be a number.' }
    sortOrder = Math.floor(n)
  }

  return { ok: true, values: { label, color, todo, fade, sortOrder } }
}

/**
 * Saving or attaching a staff tag never changes the person’s status id.
 */
export function statusIdAfterTagSave(statusId: string, _tagId?: string): string {
  return statusId
}

function normalizeTagIdList(raw: string[] | string | unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item ?? '').trim()).filter(Boolean)
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[\s,]+/)
      .map((part) => part.trim())
      .filter(Boolean)
  }
  return []
}

/**
 * Follow-up stores catalog tag ids only. Unknown ids are refused.
 * Empty list is allowed (clear tags).
 */
export function validateFollowUpTagIds(
  rawTags: string[] | string | unknown,
  catalogIds: ReadonlyArray<string>,
): { ok: true; tagIds: string[] } | { ok: false; error: string } {
  const tagIds = normalizeTagIdList(rawTags)
  const known = new Set(catalogIds.map((id) => id.trim()).filter(Boolean))
  for (const id of tagIds) {
    if (!known.has(id)) {
      return { ok: false, error: `Unknown tag id “${id}”.` }
    }
  }
  // Preserve order; drop duplicates.
  const seen = new Set<string>()
  const unique: string[] = []
  for (const id of tagIds) {
    if (seen.has(id)) continue
    seen.add(id)
    unique.push(id)
  }
  return { ok: true, tagIds: unique }
}
