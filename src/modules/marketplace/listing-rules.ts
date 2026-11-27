/**
 * Pure marketplace listing field + status rules.
 * Store and actions call these; unit tests hit this module without DB.
 */

export const LISTING_CONDITIONS = ['new', 'used', 'refurbished'] as const
export type ListingCondition = (typeof LISTING_CONDITIONS)[number]

export const LISTING_STATUSES = [
  'draft',
  'active',
  'pending',
  'sold',
  'hidden',
  'removed',
  'expired',
] as const
export type ListingStatus = (typeof LISTING_STATUSES)[number]

export type ListingActor = {
  userId: string
  /** App admin or admin.marketplace edit/manage. */
  isStaff: boolean
}

export type ListingAuthzTarget = {
  sellerUserId: string
  status: ListingStatus
}

export type ListingCreateInput = {
  title?: unknown
  description?: unknown
  condition?: unknown
  priceMinor?: unknown
  mediaIds?: unknown
  categoryId?: unknown
  areaLabel?: unknown
  latitude?: unknown
  longitude?: unknown
}

export type ListingCreateValues = {
  title: string
  description: string
  condition: ListingCondition
  priceMinor: number | null
  mediaIds: string[]
  categoryId: string
  areaLabel: string
  latitude: number | null
  longitude: number | null
}

function asTrimmed(raw: unknown): string {
  return String(raw ?? '').trim()
}

export function isListingCondition(value: unknown): value is ListingCondition {
  return (
    typeof value === 'string' &&
    (LISTING_CONDITIONS as readonly string[]).includes(value)
  )
}

export function isListingStatus(value: unknown): value is ListingStatus {
  return (
    typeof value === 'string' && (LISTING_STATUSES as readonly string[]).includes(value)
  )
}

function parsePriceMinor(
  raw: unknown,
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (raw == null || raw === '') return { ok: true, value: null }
  if (typeof raw === 'string' && raw.trim().toLowerCase() === 'free') {
    return { ok: true, value: null }
  }
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return { ok: false, error: 'Price must be a whole number of minor units, or free.' }
  }
  if (n < 0) return { ok: false, error: 'Price must be null (free) or an integer ≥ 0.' }
  return { ok: true, value: n }
}

function parseOptionalCoord(
  raw: unknown,
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (raw == null || raw === '') return { ok: true, value: null }
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isFinite(n)) return { ok: false, error: 'Coordinates must be finite numbers.' }
  return { ok: true, value: n }
}

/** Normalize ordered media ids; refuses when length exceeds photoCap. */
export function validateListingMediaIds(
  raw: unknown,
  photoCap: number,
): { ok: true; mediaIds: string[] } | { ok: false; error: string } {
  const cap =
    typeof photoCap === 'number' && Number.isFinite(photoCap) && photoCap >= 0
      ? Math.trunc(photoCap)
      : 10
  const list = Array.isArray(raw) ? raw : []
  const mediaIds: string[] = []
  for (const item of list) {
    const id = asTrimmed(item)
    if (id) mediaIds.push(id)
  }
  if (mediaIds.length > cap) {
    return {
      ok: false,
      error: `At most ${cap} photo${cap === 1 ? '' : 's'} allowed.`,
    }
  }
  return { ok: true, mediaIds }
}

/**
 * Create requires a non-empty title, a known condition, and a price that is
 * null (free) or an integer ≥ 0. Media count must not exceed photoCap.
 */
export function validateListingCreateFields(
  input: ListingCreateInput,
  photoCap: number,
): { ok: true; values: ListingCreateValues } | { ok: false; error: string } {
  const title = asTrimmed(input.title).slice(0, 200)
  if (!title) return { ok: false, error: 'Title is required.' }

  const conditionRaw = asTrimmed(input.condition).toLowerCase()
  if (!isListingCondition(conditionRaw)) {
    return { ok: false, error: 'Condition must be new, used, or refurbished.' }
  }

  const price = parsePriceMinor(input.priceMinor)
  if (!price.ok) return price

  const media = validateListingMediaIds(input.mediaIds, photoCap)
  if (!media.ok) return media

  const lat = parseOptionalCoord(input.latitude)
  if (!lat.ok) return lat
  const lng = parseOptionalCoord(input.longitude)
  if (!lng.ok) return lng

  return {
    ok: true,
    values: {
      title,
      description: asTrimmed(input.description).slice(0, 8000),
      condition: conditionRaw,
      priceMinor: price.value,
      mediaIds: media.mediaIds,
      categoryId: asTrimmed(input.categoryId).slice(0, 120),
      areaLabel: asTrimmed(input.areaLabel).slice(0, 200),
      latitude: lat.value,
      longitude: lng.value,
    },
  }
}

/**
 * Public browse predicate: active only, category enabled, expiresAt in the future.
 */
export function matchesPublicListingQuery(input: {
  status: string
  categoryEnabled: boolean
  expiresAt: Date | null | undefined
  now: Date
}): boolean {
  if (input.status !== 'active') return false
  if (!input.categoryEnabled) return false
  const expires = input.expiresAt
  if (!(expires instanceof Date) || !Number.isFinite(expires.getTime())) return false
  return expires.getTime() > input.now.getTime()
}

function isSeller(actor: ListingActor, listing: ListingAuthzTarget): boolean {
  return Boolean(actor.userId) && actor.userId === listing.sellerUserId
}

function refuseNonParticipant(
  actor: ListingActor,
  listing: ListingAuthzTarget,
): { ok: false; error: string } | null {
  if (isSeller(actor, listing) || actor.isStaff) return null
  return { ok: false, error: 'Only the seller or Marketplace staff may do that.' }
}

/** Seller may edit draft and active. Staff may edit any status. */
export function decideListingEdit(
  actor: ListingActor,
  listing: ListingAuthzTarget,
): { ok: true } | { ok: false; error: string } {
  const refused = refuseNonParticipant(actor, listing)
  if (refused) return refused
  if (actor.isStaff) return { ok: true }
  if (listing.status === 'draft' || listing.status === 'active') return { ok: true }
  return { ok: false, error: 'Seller may edit draft and active listings only.' }
}

/** Seller may hide their own. Staff may hide any status. */
export function decideListingHide(
  actor: ListingActor,
  listing: ListingAuthzTarget,
): { ok: true; nextStatus: 'hidden' } | { ok: false; error: string } {
  const refused = refuseNonParticipant(actor, listing)
  if (refused) return refused
  if (listing.status === 'hidden') {
    return { ok: false, error: 'Listing is already hidden.' }
  }
  if (listing.status === 'removed') {
    return { ok: false, error: 'Removed listings cannot be hidden; restore first.' }
  }
  return { ok: true, nextStatus: 'hidden' }
}

/** Staff may remove any status. */
export function decideListingRemove(
  actor: ListingActor,
  listing: ListingAuthzTarget,
): { ok: true; nextStatus: 'removed' } | { ok: false; error: string } {
  if (!actor.isStaff) {
    return { ok: false, error: 'Only Marketplace staff may remove a listing.' }
  }
  if (listing.status === 'removed') {
    return { ok: false, error: 'Listing is already removed.' }
  }
  return { ok: true, nextStatus: 'removed' }
}

/** Staff may restore hidden or removed listings to active. */
export function decideListingRestore(
  actor: ListingActor,
  listing: ListingAuthzTarget,
): { ok: true; nextStatus: 'active' } | { ok: false; error: string } {
  if (!actor.isStaff) {
    return { ok: false, error: 'Only Marketplace staff may restore a listing.' }
  }
  if (listing.status !== 'hidden' && listing.status !== 'removed') {
    return { ok: false, error: 'Only hidden or removed listings can be restored.' }
  }
  return { ok: true, nextStatus: 'active' }
}

/** Seller may move active → pending. */
export function decideListingMarkPending(
  actor: ListingActor,
  listing: ListingAuthzTarget,
): { ok: true; nextStatus: 'pending' } | { ok: false; error: string } {
  const refused = refuseNonParticipant(actor, listing)
  if (refused) return refused
  if (!isSeller(actor, listing) && !actor.isStaff) {
    return { ok: false, error: 'Only the seller or Marketplace staff may do that.' }
  }
  if (listing.status !== 'active') {
    return { ok: false, error: 'Only an active listing can be marked pending.' }
  }
  return { ok: true, nextStatus: 'pending' }
}

/** Seller may move pending → sold. */
export function decideListingMarkSold(
  actor: ListingActor,
  listing: ListingAuthzTarget,
): { ok: true; nextStatus: 'sold' } | { ok: false; error: string } {
  const refused = refuseNonParticipant(actor, listing)
  if (refused) return refused
  if (listing.status !== 'pending') {
    return { ok: false, error: 'Only a pending listing can be marked sold.' }
  }
  return { ok: true, nextStatus: 'sold' }
}

/** Seller may renew: expiresAt = now + expiryDays. */
export function decideListingRenew(
  actor: ListingActor,
  listing: ListingAuthzTarget,
  expiryDays: number,
  now: Date,
):
  | { ok: true; expiresAt: Date; nextStatus: ListingStatus }
  | { ok: false; error: string } {
  const refused = refuseNonParticipant(actor, listing)
  if (refused) return refused
  if (!isSeller(actor, listing) && !actor.isStaff) {
    return { ok: false, error: 'Only the seller or Marketplace staff may renew.' }
  }
  const days =
    typeof expiryDays === 'number' && Number.isFinite(expiryDays) && expiryDays > 0
      ? Math.trunc(expiryDays)
      : 0
  if (days < 1) return { ok: false, error: 'Expiry days must be a positive integer.' }
  if (listing.status === 'removed' || listing.status === 'sold') {
    return { ok: false, error: 'Sold or removed listings cannot be renewed.' }
  }
  const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
  const nextStatus: ListingStatus =
    listing.status === 'expired' || listing.status === 'hidden'
      ? 'active'
      : listing.status
  return { ok: true, expiresAt, nextStatus }
}
