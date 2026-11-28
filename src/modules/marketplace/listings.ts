/**
 * Marketplace listings — admin moderation, public browse, seller writes.
 * Pure rules stay in listing-rules.ts / browse-rules.ts.
 */

import 'server-only'

import { desc, eq, inArray } from 'drizzle-orm'

import { db } from '@/core/db'

import {
  filterAndSortPublicListings,
  parseBrowsePoint,
  parseBrowseSort,
  type BrowseFilters,
  type BrowseListingCandidate,
} from './browse-rules'
import {
  decideListingFeeHookAction,
  decideListingPublishWithFee,
} from './listing-fee-rules'
import {
  decideListingEdit,
  decideListingHide,
  decideListingMarkPending,
  decideListingMarkSold,
  decideListingRemove,
  decideListingRenew,
  decideListingRestore,
  isListingCondition,
  isListingStatus,
  matchesPublicListingQuery,
  validateListingCreateFields,
  type ListingActor,
  type ListingCreateInput,
  type ListingStatus,
} from './listing-rules'
import { findMarketplaceCategoryById, listMarketplaceCategories } from './categories'
import { loadMarketplaceModuleSettings } from './settings'
import { sfMarketplaceListings } from './schema'
import type { MarketplaceListingRecord } from './types'

function tableMissingMessage(error: unknown): string | null {
  const msg = error instanceof Error ? error.message : String(error)
  if (msg.includes('sf_marketplace_listings') || /does not exist|relation/i.test(msg)) {
    return 'sf_marketplace_listings missing — run npm run db:migrate.'
  }
  return null
}

function mapListingRow(
  row: typeof sfMarketplaceListings.$inferSelect,
): MarketplaceListingRecord {
  const condition = isListingCondition(row.condition) ? row.condition : 'used'
  const status: ListingStatus = isListingStatus(row.status) ? row.status : 'draft'
  const mediaIds = Array.isArray(row.mediaIds)
    ? row.mediaIds.map((id) => String(id ?? '').trim()).filter(Boolean)
    : []
  return {
    id: row.id,
    sellerUserId: (row.sellerUserId || '').trim(),
    categoryId: (row.categoryId || '').trim(),
    title: (row.title || '').trim() || 'Untitled listing',
    description: (row.description || '').trim(),
    priceMinor:
      row.priceMinor == null || !Number.isFinite(row.priceMinor)
        ? null
        : Math.trunc(row.priceMinor),
    condition,
    status,
    areaLabel: (row.areaLabel || '').trim(),
    latitude:
      row.latitude == null || !Number.isFinite(row.latitude) ? null : row.latitude,
    longitude:
      row.longitude == null || !Number.isFinite(row.longitude) ? null : row.longitude,
    expiresAt: row.expiresAt instanceof Date ? row.expiresAt : null,
    soldToUserId: (row.soldToUserId || '').trim() || null,
    mediaIds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listMarketplaceListingsForAdmin(limit = 200): Promise<{
  listings: MarketplaceListingRecord[]
  error?: string
}> {
  try {
    const rows = await db
      .select()
      .from(sfMarketplaceListings)
      .orderBy(desc(sfMarketplaceListings.updatedAt))
      .limit(Math.max(1, Math.min(500, Math.trunc(limit))))
    return { listings: rows.map(mapListingRow) }
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return { listings: [], error: missing }
    throw error
  }
}

export async function getMarketplaceListing(
  id: string,
): Promise<MarketplaceListingRecord | null> {
  const key = String(id ?? '').trim()
  if (!key) return null
  try {
    const rows = await db
      .select()
      .from(sfMarketplaceListings)
      .where(eq(sfMarketplaceListings.id, key))
      .limit(1)
    const row = rows[0]
    return row ? mapListingRow(row) : null
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return null
    throw error
  }
}

export async function listMarketplaceListingsForSeller(
  sellerUserId: string,
  limit = 200,
): Promise<MarketplaceListingRecord[]> {
  const seller = String(sellerUserId ?? '').trim()
  if (!seller) return []
  try {
    const rows = await db
      .select()
      .from(sfMarketplaceListings)
      .where(eq(sfMarketplaceListings.sellerUserId, seller))
      .orderBy(desc(sfMarketplaceListings.updatedAt))
      .limit(Math.max(1, Math.min(500, Math.trunc(limit))))
    return rows.map(mapListingRow)
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return []
    throw error
  }
}

export type PublicMarketplaceListing = MarketplaceListingRecord & {
  distanceKm: number | null
  categoryTitle: string
}

/**
 * Public browse: active + enabled category + unexpired, then filters/sort.
 */
export async function queryPublicMarketplaceListings(
  filters: BrowseFilters = {},
): Promise<{ listings: PublicMarketplaceListing[]; error?: string }> {
  try {
    const [rows, categories] = await Promise.all([
      db.select().from(sfMarketplaceListings),
      listMarketplaceCategories(),
    ])
    const enabledById = new Map(categories.map((c) => [c.id, c.enabled !== false]))
    const titleById = new Map(categories.map((c) => [c.id, c.title]))
    const candidates: BrowseListingCandidate[] = rows.map((row) => {
      const mapped = mapListingRow(row)
      return {
        id: mapped.id,
        title: mapped.title,
        description: mapped.description,
        priceMinor: mapped.priceMinor,
        condition: mapped.condition,
        status: mapped.status,
        categoryId: mapped.categoryId,
        categoryEnabled: enabledById.get(mapped.categoryId) === true,
        areaLabel: mapped.areaLabel,
        latitude: mapped.latitude,
        longitude: mapped.longitude,
        expiresAt: mapped.expiresAt,
        createdAt: mapped.createdAt,
      }
    })
    const sorted = filterAndSortPublicListings(candidates, filters)
    const byId = new Map(rows.map((row) => [row.id, mapListingRow(row)]))
    const listings: PublicMarketplaceListing[] = []
    for (const row of sorted) {
      const full = byId.get(row.id)
      if (!full) continue
      listings.push({
        ...full,
        distanceKm: row.distanceKm,
        categoryTitle: titleById.get(full.categoryId) || '',
      })
    }
    return { listings }
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return { listings: [], error: missing }
    throw error
  }
}

/** Public detail: only when the public predicate passes (or seller/staff viewing own). */
export async function getPublicMarketplaceListing(
  id: string,
  opts?: { viewerUserId?: string | null; isStaff?: boolean },
): Promise<
  | { listing: MarketplaceListingRecord; categoryTitle: string; publicVisible: boolean }
  | null
> {
  const listing = await getMarketplaceListing(id)
  if (!listing) return null
  const category = listing.categoryId
    ? await findMarketplaceCategoryById(listing.categoryId)
    : null
  const categoryEnabled = category?.enabled === true
  const now = new Date()
  const publicVisible = matchesPublicListingQuery({
    status: listing.status,
    categoryEnabled,
    expiresAt: listing.expiresAt,
    now,
  })
  const viewerUserId = (opts?.viewerUserId || '').trim()
  const isOwner = Boolean(viewerUserId) && viewerUserId === listing.sellerUserId
  const isStaff = opts?.isStaff === true
  /** Sold-to buyer may open detail after handoff (ratings / receipt). */
  const isSoldBuyer =
    Boolean(viewerUserId) &&
    Boolean(listing.soldToUserId) &&
    viewerUserId === listing.soldToUserId
  if (!publicVisible && !isOwner && !isStaff && !isSoldBuyer) return null
  return {
    listing,
    categoryTitle: category?.title || '',
    publicVisible,
  }
}

export function browseFiltersFromSearchParams(input: {
  q?: string | string[] | undefined
  category?: string | string[] | undefined
  priceMin?: string | string[] | undefined
  priceMax?: string | string[] | undefined
  condition?: string | string[] | undefined
  distance?: string | string[] | undefined
  sort?: string | string[] | undefined
  lat?: string | string[] | undefined
  lng?: string | string[] | undefined
}): BrowseFilters {
  const one = (v: string | string[] | undefined) =>
    Array.isArray(v) ? String(v[0] ?? '') : String(v ?? '')
  const priceMinRaw = one(input.priceMin).trim()
  const priceMaxRaw = one(input.priceMax).trim()
  const distanceRaw = one(input.distance).trim()
  const conditionRaw = one(input.condition).trim().toLowerCase()
  return {
    text: one(input.q).trim(),
    categoryId: one(input.category).trim(),
    priceMinMinor: priceMinRaw === '' ? null : Number(priceMinRaw),
    priceMaxMinor: priceMaxRaw === '' ? null : Number(priceMaxRaw),
    condition: isListingCondition(conditionRaw) ? conditionRaw : '',
    maxDistanceKm: distanceRaw === '' ? null : Number(distanceRaw),
    sort: parseBrowseSort(one(input.sort)),
    viewer: parseBrowsePoint({ latitude: one(input.lat), longitude: one(input.lng) }),
    now: new Date(),
  }
}

async function applyStatus(
  id: string,
  nextStatus: ListingStatus,
  extra?: Partial<typeof sfMarketplaceListings.$inferInsert>,
): Promise<{ listing: MarketplaceListingRecord } | { error: string }> {
  try {
    const updated = await db
      .update(sfMarketplaceListings)
      .set({ status: nextStatus, updatedAt: new Date(), ...extra })
      .where(eq(sfMarketplaceListings.id, id))
      .returning()
    const row = updated[0]
    if (!row) return { error: 'Listing not found.' }
    return { listing: mapListingRow(row) }
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return { error: missing }
    throw error
  }
}

export async function hideMarketplaceListing(
  id: string,
  actor: ListingActor,
): Promise<{ listing: MarketplaceListingRecord } | { error: string }> {
  const listing = await getMarketplaceListing(id)
  if (!listing) return { error: 'Listing not found.' }
  const decision = decideListingHide(actor, listing)
  if (!decision.ok) return { error: decision.error }
  return applyStatus(listing.id, decision.nextStatus)
}

export async function removeMarketplaceListing(
  id: string,
  actor: ListingActor,
): Promise<{ listing: MarketplaceListingRecord } | { error: string }> {
  const listing = await getMarketplaceListing(id)
  if (!listing) return { error: 'Listing not found.' }
  const decision = decideListingRemove(actor, listing)
  if (!decision.ok) return { error: decision.error }
  return applyStatus(listing.id, decision.nextStatus)
}

export async function restoreMarketplaceListing(
  id: string,
  actor: ListingActor,
): Promise<{ listing: MarketplaceListingRecord } | { error: string }> {
  const listing = await getMarketplaceListing(id)
  if (!listing) return { error: 'Listing not found.' }
  const decision = decideListingRestore(actor, listing)
  if (!decision.ok) return { error: decision.error }
  return applyStatus(listing.id, decision.nextStatus)
}

export async function markMarketplaceListingPending(
  id: string,
  actor: ListingActor,
): Promise<{ listing: MarketplaceListingRecord } | { error: string }> {
  const listing = await getMarketplaceListing(id)
  if (!listing) return { error: 'Listing not found.' }
  const decision = decideListingMarkPending(actor, listing)
  if (!decision.ok) return { error: decision.error }
  return applyStatus(listing.id, decision.nextStatus)
}

export async function markMarketplaceListingSold(
  id: string,
  actor: ListingActor,
  soldToUserId?: string | null,
): Promise<{ listing: MarketplaceListingRecord } | { error: string }> {
  const listing = await getMarketplaceListing(id)
  if (!listing) return { error: 'Listing not found.' }
  const decision = decideListingMarkSold(actor, listing)
  if (!decision.ok) return { error: decision.error }
  const soldTo = String(soldToUserId ?? '').trim() || null
  return applyStatus(listing.id, decision.nextStatus, { soldToUserId: soldTo })
}

export async function renewMarketplaceListing(
  id: string,
  actor: ListingActor,
): Promise<{ listing: MarketplaceListingRecord } | { error: string }> {
  const listing = await getMarketplaceListing(id)
  if (!listing) return { error: 'Listing not found.' }
  const { settings } = await loadMarketplaceModuleSettings()
  const decision = decideListingRenew(actor, listing, settings.expiryDays, new Date())
  if (!decision.ok) return { error: decision.error }
  return applyStatus(listing.id, decision.nextStatus, { expiresAt: decision.expiresAt })
}

export type CreateMarketplaceListingInput = ListingCreateInput & {
  /** When true (default), publish (active when fee off; draft until paid when fee on). */
  publish?: boolean
}

export type CreateMarketplaceListingResult =
  | {
      listing: MarketplaceListingRecord
      /** True when Payments must collect the listing fee before activation. */
      needsCheckout: boolean
      /** Server-quoted fee in minor units when needsCheckout. */
      feeMinor: number
    }
  | { error: string }

export async function createMarketplaceListing(
  sellerUserId: string,
  input: CreateMarketplaceListingInput,
): Promise<CreateMarketplaceListingResult> {
  const seller = String(sellerUserId ?? '').trim()
  if (!seller) return { error: 'Sign in required.' }

  const { settings } = await loadMarketplaceModuleSettings()
  const validated = validateListingCreateFields(input, settings.photoCap)
  if (!validated.ok) return { error: validated.error }

  const categoryId = validated.values.categoryId
  if (!categoryId) return { error: 'Category is required.' }
  const category = await findMarketplaceCategoryById(categoryId)
  if (!category) return { error: 'Category not found.' }
  if (!category.enabled) return { error: 'That category is disabled.' }

  const publish = input.publish !== false
  const fee = decideListingPublishWithFee(
    {
      listingFeeEnabled: settings.listingFeeEnabled,
      listingFeeMinor: settings.listingFeeMinor,
    },
    publish,
  )
  const status: ListingStatus = fee.status
  const now = new Date()
  const expiresAt =
    fee.status === 'active'
      ? new Date(now.getTime() + settings.expiryDays * 24 * 60 * 60 * 1000)
      : null
  const id = crypto.randomUUID()

  try {
    const inserted = await db
      .insert(sfMarketplaceListings)
      .values({
        id,
        sellerUserId: seller,
        categoryId,
        title: validated.values.title,
        description: validated.values.description,
        priceMinor: validated.values.priceMinor,
        condition: validated.values.condition,
        status,
        areaLabel: validated.values.areaLabel,
        latitude: validated.values.latitude,
        longitude: validated.values.longitude,
        expiresAt,
        soldToUserId: null,
        mediaIds: validated.values.mediaIds,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    const row = inserted[0]
    if (!row) return { error: 'Could not create listing.' }
    return {
      listing: mapListingRow(row),
      needsCheckout: fee.needsCart,
      feeMinor: fee.feeMinor,
    }
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return { error: missing }
    throw error
  }
}

/**
 * Apply marketplace.listingFeePaid. Idempotent: a second paid event does not
 * re-activate or create another listing. expired/failed leave draft; refunded → hidden.
 */
export async function applyMarketplaceListingFeeHook(
  listingId: string,
  paymentStatus: 'paid' | 'expired' | 'failed' | 'refunded',
): Promise<void> {
  const id = String(listingId ?? '').trim()
  if (!id) return
  const listing = await getMarketplaceListing(id)
  if (!listing) return
  const decision = decideListingFeeHookAction(listing.status, paymentStatus)
  if (decision.action === 'noop' || decision.action === 'leave_draft') return
  if (decision.action === 'activate') {
    const { settings } = await loadMarketplaceModuleSettings()
    const days =
      typeof settings.expiryDays === 'number' &&
      Number.isFinite(settings.expiryDays) &&
      settings.expiryDays > 0
        ? Math.trunc(settings.expiryDays)
        : 30
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    await applyStatus(listing.id, decision.nextStatus, { expiresAt })
    return
  }
  if (decision.action === 'hide') {
    await applyStatus(listing.id, decision.nextStatus)
  }
}

export async function updateMarketplaceListing(
  id: string,
  actor: ListingActor,
  input: ListingCreateInput,
): Promise<{ listing: MarketplaceListingRecord } | { error: string }> {
  const listing = await getMarketplaceListing(id)
  if (!listing) return { error: 'Listing not found.' }
  const edit = decideListingEdit(actor, listing)
  if (!edit.ok) return { error: edit.error }

  const { settings } = await loadMarketplaceModuleSettings()
  const validated = validateListingCreateFields(input, settings.photoCap)
  if (!validated.ok) return { error: validated.error }

  const categoryId = validated.values.categoryId || listing.categoryId
  if (!categoryId) return { error: 'Category is required.' }
  const category = await findMarketplaceCategoryById(categoryId)
  if (!category) return { error: 'Category not found.' }
  if (!category.enabled && categoryId !== listing.categoryId) {
    return { error: 'That category is disabled.' }
  }

  try {
    const updated = await db
      .update(sfMarketplaceListings)
      .set({
        categoryId,
        title: validated.values.title,
        description: validated.values.description,
        priceMinor: validated.values.priceMinor,
        condition: validated.values.condition,
        areaLabel: validated.values.areaLabel,
        latitude: validated.values.latitude,
        longitude: validated.values.longitude,
        mediaIds: validated.values.mediaIds,
        updatedAt: new Date(),
      })
      .where(eq(sfMarketplaceListings.id, listing.id))
      .returning()
    const row = updated[0]
    if (!row) return { error: 'Listing not found.' }
    return { listing: mapListingRow(row) }
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return { error: missing }
    throw error
  }
}

/** Sync expired active listings whose expiresAt has passed (best-effort on read paths). */
export async function syncExpiredMarketplaceListings(
  ids?: string[],
): Promise<void> {
  const now = new Date()
  try {
    const rows =
      ids && ids.length > 0
        ? await db
            .select()
            .from(sfMarketplaceListings)
            .where(inArray(sfMarketplaceListings.id, ids))
        : await db
            .select()
            .from(sfMarketplaceListings)
            .where(eq(sfMarketplaceListings.status, 'active'))
    const expiredIds = rows
      .map(mapListingRow)
      .filter(
        (row) =>
          row.status === 'active' &&
          row.expiresAt instanceof Date &&
          row.expiresAt.getTime() <= now.getTime(),
      )
      .map((row) => row.id)
    if (expiredIds.length === 0) return
    await db
      .update(sfMarketplaceListings)
      .set({ status: 'expired', updatedAt: now })
      .where(inArray(sfMarketplaceListings.id, expiredIds))
  } catch {
    // Best-effort; public query already excludes past expiresAt.
  }
}
