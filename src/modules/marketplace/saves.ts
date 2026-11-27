/**
 * Marketplace listing saves — member write + list for /marketplace/you.
 * Pure rules stay in save-rules.ts; public predicate from listing-rules.ts.
 */

import 'server-only'

import { and, desc, eq, inArray } from 'drizzle-orm'

import { db } from '@/core/db'

import { findMarketplaceCategoryById } from './categories'
import { getMarketplaceListing } from './listings'
import {
  isListingCondition,
  isListingStatus,
  matchesPublicListingQuery,
  type ListingStatus,
} from './listing-rules'
import {
  decideMarketplaceSave,
  decideMarketplaceUnsave,
  type MarketplaceSaveRecord,
} from './save-rules'
import { sfMarketplaceListings, sfMarketplaceSaves } from './schema'
import type { MarketplaceListingRecord } from './types'

function tableMissingMessage(error: unknown): string | null {
  const msg = error instanceof Error ? error.message : String(error)
  if (msg.includes('sf_marketplace_saves') || /does not exist|relation/i.test(msg)) {
    return 'sf_marketplace_saves missing — run npm run db:migrate.'
  }
  return null
}

function mapSaveRow(row: typeof sfMarketplaceSaves.$inferSelect): MarketplaceSaveRecord {
  return {
    id: row.id,
    userId: (row.userId || '').trim(),
    listingId: (row.listingId || '').trim(),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
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

export async function findMarketplaceSave(
  userId: string,
  listingId: string,
): Promise<MarketplaceSaveRecord | null> {
  const uid = String(userId ?? '').trim()
  const lid = String(listingId ?? '').trim()
  if (!uid || !lid) return null
  try {
    const rows = await db
      .select()
      .from(sfMarketplaceSaves)
      .where(and(eq(sfMarketplaceSaves.userId, uid), eq(sfMarketplaceSaves.listingId, lid)))
      .limit(1)
    const row = rows[0]
    return row ? mapSaveRow(row) : null
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return null
    throw error
  }
}

export async function isMarketplaceListingSaved(
  userId: string,
  listingId: string,
): Promise<boolean> {
  return Boolean(await findMarketplaceSave(userId, listingId))
}

async function listingIsPublic(listing: MarketplaceListingRecord): Promise<boolean> {
  const category = listing.categoryId
    ? await findMarketplaceCategoryById(listing.categoryId)
    : null
  return matchesPublicListingQuery({
    status: listing.status,
    categoryEnabled: category?.enabled === true,
    expiresAt: listing.expiresAt,
    now: new Date(),
  })
}

/** Save a public listing. Second save of the same pair is a no-op success. */
export async function saveMarketplaceListing(
  userId: string,
  listingId: string,
): Promise<{ save: MarketplaceSaveRecord } | { error: string }> {
  const uid = String(userId ?? '').trim()
  const lid = String(listingId ?? '').trim()
  if (!uid) return { error: 'Sign in to save a listing.' }
  if (!lid) return { error: 'Missing listing id.' }

  const listing = await getMarketplaceListing(lid)
  if (!listing) return { error: 'Listing not found.' }

  const isPublic = await listingIsPublic(listing)
  const current = await findMarketplaceSave(uid, lid)
  const decision = decideMarketplaceSave(current, { userId: uid, listingId: lid }, { isPublic })
  if (!decision.ok) return { error: decision.error }
  if (decision.write === 'noop') return { save: decision.save }

  try {
    await db.insert(sfMarketplaceSaves).values({
      id: decision.save.id,
      userId: decision.save.userId,
      listingId: decision.save.listingId,
      createdAt: decision.save.createdAt,
      updatedAt: decision.save.updatedAt,
    })
    return { save: decision.save }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    const missing = tableMissingMessage(error)
    if (missing) return { error: missing }
    // Unique (userId, listingId): concurrent second insert → no-op success.
    if (/unique|duplicate/i.test(msg)) {
      const existing = await findMarketplaceSave(uid, lid)
      if (existing) return { save: existing }
    }
    throw error
  }
}

/** Remove a save row for the signed-in user. */
export async function unsaveMarketplaceListing(
  userId: string,
  listingId: string,
): Promise<{ removed: MarketplaceSaveRecord } | { error: string }> {
  const uid = String(userId ?? '').trim()
  const lid = String(listingId ?? '').trim()
  const current = await findMarketplaceSave(uid, lid)
  const decision = decideMarketplaceUnsave(current, uid, lid)
  if (!decision.ok) return { error: decision.error }

  try {
    await db.delete(sfMarketplaceSaves).where(eq(sfMarketplaceSaves.id, decision.removed.id))
    return { removed: decision.removed }
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return { error: missing }
    throw error
  }
}

export type MarketplaceSavedListing = {
  save: MarketplaceSaveRecord
  listing: MarketplaceListingRecord
}

/** Saved listings for /marketplace/you, newest save first. */
export async function listMarketplaceSavesForUser(
  userId: string,
  limit = 200,
): Promise<MarketplaceSavedListing[]> {
  const uid = String(userId ?? '').trim()
  if (!uid) return []
  try {
    const rows = await db
      .select()
      .from(sfMarketplaceSaves)
      .where(eq(sfMarketplaceSaves.userId, uid))
      .orderBy(desc(sfMarketplaceSaves.createdAt))
      .limit(Math.max(1, Math.min(500, Math.trunc(limit))))
    if (rows.length === 0) return []

    const listingIds = [
      ...new Set(rows.map((r) => (r.listingId || '').trim()).filter(Boolean)),
    ]
    const listingById = new Map<string, MarketplaceListingRecord>()
    if (listingIds.length > 0) {
      const listingRows = await db
        .select()
        .from(sfMarketplaceListings)
        .where(inArray(sfMarketplaceListings.id, listingIds))
      for (const row of listingRows) {
        const mapped = mapListingRow(row)
        listingById.set(mapped.id, mapped)
      }
    }

    const out: MarketplaceSavedListing[] = []
    for (const row of rows) {
      const save = mapSaveRow(row)
      const listing = listingById.get(save.listingId)
      if (!listing) continue
      out.push({ save, listing })
    }
    return out
  } catch (error) {
    const missing = tableMissingMessage(error)
    if (missing) return []
    throw error
  }
}
