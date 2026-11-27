/**
 * Pure marketplace browse helpers (haversine, filter, sort).
 * Store and pages call these; unit tests hit this module without DB.
 */

import {
  isListingCondition,
  matchesPublicListingQuery,
  type ListingCondition,
} from './listing-rules'

const EARTH_RADIUS_KM = 6371

export type BrowseSort = 'distance' | 'newest' | 'price'

export type BrowsePoint = {
  latitude: number
  longitude: number
}

export type BrowseListingCandidate = {
  id: string
  title: string
  description: string
  priceMinor: number | null
  condition: string
  status: string
  categoryId: string
  categoryEnabled: boolean
  areaLabel: string
  latitude: number | null
  longitude: number | null
  expiresAt: Date | null
  createdAt: Date
}

export type BrowseFilters = {
  text?: string
  categoryId?: string
  priceMinMinor?: number | null
  priceMaxMinor?: number | null
  condition?: ListingCondition | ''
  /** When set with a viewer point, keep listings within this many km. */
  maxDistanceKm?: number | null
  sort?: BrowseSort
  viewer?: BrowsePoint | null
  now?: Date
}

/** Great-circle distance in km between two WGS84 points. */
export function haversineKm(
  a: BrowsePoint,
  b: BrowsePoint,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.latitude - a.latitude)
  const dLng = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function listingHasCoordinates(
  listing: Pick<BrowseListingCandidate, 'latitude' | 'longitude'>,
): boolean {
  return (
    listing.latitude != null &&
    Number.isFinite(listing.latitude) &&
    listing.longitude != null &&
    Number.isFinite(listing.longitude)
  )
}

/**
 * Distance from viewer to listing, or null when either side lacks coordinates.
 * Null-coordinate listings are omitted from a distance sort.
 */
export function listingDistanceKm(
  listing: Pick<BrowseListingCandidate, 'latitude' | 'longitude'>,
  viewer: BrowsePoint | null | undefined,
): number | null {
  if (!viewer) return null
  if (!listingHasCoordinates(listing)) return null
  return haversineKm(viewer, {
    latitude: listing.latitude as number,
    longitude: listing.longitude as number,
  })
}

function parseOptionalNonNegInt(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isFinite(n) || n < 0) return null
  return Math.trunc(n)
}

export function parseBrowseSort(raw: unknown): BrowseSort {
  const s = String(raw ?? '').trim().toLowerCase()
  if (s === 'distance' || s === 'newest' || s === 'price') return s
  return 'newest'
}

export function parseBrowsePoint(input: {
  latitude?: unknown
  longitude?: unknown
}): BrowsePoint | null {
  const latRaw = input.latitude
  const lngRaw = input.longitude
  if (latRaw == null || latRaw === '' || lngRaw == null || lngRaw === '') return null
  const latitude = typeof latRaw === 'number' ? latRaw : Number(String(latRaw).trim())
  const longitude = typeof lngRaw === 'number' ? lngRaw : Number(String(lngRaw).trim())
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
  return { latitude, longitude }
}

/**
 * Apply the public predicate, then text / category / price / condition / distance
 * filters and sort. Distance sort drops listings without coordinates.
 */
export function filterAndSortPublicListings(
  candidates: BrowseListingCandidate[],
  filters: BrowseFilters = {},
): Array<BrowseListingCandidate & { distanceKm: number | null }> {
  const now = filters.now instanceof Date ? filters.now : new Date()
  const sort = filters.sort ?? 'newest'
  const viewer = filters.viewer ?? null
  const text = String(filters.text ?? '').trim().toLowerCase()
  const categoryId = String(filters.categoryId ?? '').trim()
  const conditionRaw = String(filters.condition ?? '').trim().toLowerCase()
  const condition =
    conditionRaw && isListingCondition(conditionRaw) ? conditionRaw : ''
  const priceMin = parseOptionalNonNegInt(filters.priceMinMinor)
  const priceMax = parseOptionalNonNegInt(filters.priceMaxMinor)
  const maxDistanceRaw = filters.maxDistanceKm
  const maxDistance =
    maxDistanceRaw == null || !Number.isFinite(maxDistanceRaw)
      ? null
      : Number(maxDistanceRaw)

  const rows: Array<BrowseListingCandidate & { distanceKm: number | null }> = []
  for (const listing of candidates) {
    if (
      !matchesPublicListingQuery({
        status: listing.status,
        categoryEnabled: listing.categoryEnabled,
        expiresAt: listing.expiresAt,
        now,
      })
    ) {
      continue
    }
    if (categoryId && listing.categoryId !== categoryId) continue
    if (condition && listing.condition !== condition) continue
    if (text) {
      const hay = `${listing.title}\n${listing.description}\n${listing.areaLabel}`.toLowerCase()
      if (!hay.includes(text)) continue
    }
    const price = listing.priceMinor
    if (priceMin != null) {
      if (price == null || price < priceMin) continue
    }
    if (priceMax != null) {
      if (price == null || price > priceMax) continue
    }
    const distanceKm = listingDistanceKm(listing, viewer)
    if (
      maxDistance != null &&
      Number.isFinite(maxDistance) &&
      maxDistance >= 0 &&
      viewer
    ) {
      if (distanceKm == null || distanceKm > maxDistance) continue
    }
    if (sort === 'distance' && distanceKm == null) continue
    rows.push({ ...listing, distanceKm })
  }

  rows.sort((a, b) => {
    if (sort === 'distance') {
      const da = a.distanceKm ?? Number.POSITIVE_INFINITY
      const db = b.distanceKm ?? Number.POSITIVE_INFINITY
      if (da !== db) return da - db
      return b.createdAt.getTime() - a.createdAt.getTime()
    }
    if (sort === 'price') {
      const pa = a.priceMinor == null ? Number.POSITIVE_INFINITY : a.priceMinor
      const pb = b.priceMinor == null ? Number.POSITIVE_INFINITY : b.priceMinor
      if (pa !== pb) return pa - pb
      return b.createdAt.getTime() - a.createdAt.getTime()
    }
    // newest
    return b.createdAt.getTime() - a.createdAt.getTime()
  })

  return rows
}
