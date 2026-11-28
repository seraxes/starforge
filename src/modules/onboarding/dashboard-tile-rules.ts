/**
 * Pure driver-home dashboard tile rules.
 * Store / particle / actions call these; unit tests hit this module without DB.
 *
 * Empty statusIds = every person who has a status.
 * A non-empty list hides the tile when the person’s status is not listed.
 * Unpublished and staff-only (for non-staff) are hidden.
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

export function asDashboardTileStatusIdList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item ?? '').trim()).filter(Boolean)
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[\n,]/)
      .map((part) => part.trim())
      .filter(Boolean)
  }
  return []
}

export type DashboardTileFieldInput = {
  title?: unknown
  icon?: unknown
  url?: unknown
  sortOrder?: unknown
  published?: unknown
  statusIds?: unknown
  staffOnly?: unknown
}

export type DashboardTileFieldValues = {
  title: string
  icon: string
  url: string
  sortOrder: number
  published: boolean
  statusIds: string[]
  staffOnly: boolean
}

/** Tile fields for create / update. Empty title is refused. */
export function validateDashboardTileFields(
  input: DashboardTileFieldInput,
  existing?: Partial<DashboardTileFieldValues>,
): { ok: true; values: DashboardTileFieldValues } | { ok: false; error: string } {
  const title = asTrimmed(input.title !== undefined ? input.title : existing?.title)
  if (!title) return { ok: false, error: 'Tile title is required.' }

  const icon = asTrimmed(input.icon !== undefined ? input.icon : (existing?.icon ?? ''))
  const url = asTrimmed(input.url !== undefined ? input.url : (existing?.url ?? ''))

  let sortOrder = existing?.sortOrder ?? 0
  if (input.sortOrder !== undefined && input.sortOrder !== null && input.sortOrder !== '') {
    const n =
      typeof input.sortOrder === 'number'
        ? input.sortOrder
        : Number(String(input.sortOrder).trim())
    if (!Number.isFinite(n)) return { ok: false, error: 'Sort order must be a number.' }
    sortOrder = Math.floor(n)
  }

  // Checkbox absence (null / '') means unchecked → false when the field was submitted.
  const published =
    input.published !== undefined
      ? asBool(input.published, false)
      : Boolean(existing?.published ?? true)
  const staffOnly =
    input.staffOnly !== undefined
      ? asBool(input.staffOnly, false)
      : Boolean(existing?.staffOnly ?? false)

  const statusIds =
    input.statusIds !== undefined
      ? asDashboardTileStatusIdList(input.statusIds)
      : [...(existing?.statusIds ?? [])]

  // Preserve order; drop duplicates.
  const seen = new Set<string>()
  const uniqueStatusIds: string[] = []
  for (const id of statusIds) {
    if (seen.has(id)) continue
    seen.add(id)
    uniqueStatusIds.push(id)
  }

  return {
    ok: true,
    values: {
      title,
      icon,
      url,
      sortOrder,
      published,
      statusIds: uniqueStatusIds,
      staffOnly,
    },
  }
}

export type DashboardTileVisibilityInput = {
  published: boolean
  statusIds: ReadonlyArray<string>
  staffOnly: boolean
}

/**
 * Whether a tile is shown on the driver home for this viewer.
 * Person must have a status. Empty statusIds → every status.
 * Unpublished → hidden. Staff-only → staff only.
 */
export function isDashboardTileVisibleForViewer(
  tile: DashboardTileVisibilityInput,
  personStatusId: string,
  viewerIsOnboardingStaff: boolean,
): boolean {
  if (!tile.published) return false
  const statusId = asTrimmed(personStatusId)
  if (!statusId) return false
  if (tile.staffOnly && !viewerIsOnboardingStaff) return false
  const allowed = tile.statusIds.map((id) => asTrimmed(id)).filter(Boolean)
  if (allowed.length === 0) return true
  return allowed.includes(statusId)
}

/**
 * Filter and order tiles for the particle.
 * Input should already be sorted by sortOrder; this only filters.
 */
export function filterDashboardTilesForViewer<T extends DashboardTileVisibilityInput>(
  tiles: ReadonlyArray<T>,
  personStatusId: string,
  viewerIsOnboardingStaff: boolean,
): T[] {
  return tiles.filter((tile) =>
    isDashboardTileVisibleForViewer(tile, personStatusId, viewerIsOnboardingStaff),
  )
}
