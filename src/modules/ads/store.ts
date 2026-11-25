/**
 * Ads packages, placements, credits, campaigns CRUD.
 */

import 'server-only'

import { asc, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { db } from '@/core/db'

import {
  type PackageFieldInput,
  type PlacementFieldInput,
  validatePackageFields,
  validatePlacementFields,
} from './catalog'
import { sfAdsCampaigns, sfAdsCredits, sfAdsPackages, sfAdsPlacements } from './schema'
import {
  isCampaignStatus,
  type AdsCampaignRecord,
  type AdsCreditBalanceRecord,
  type AdsPackageRecord,
  type AdsPlacementRecord,
  type CampaignStatus,
} from './types'

function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`
}

function asStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    const s = String(item ?? '').trim()
    if (s && !out.includes(s)) out.push(s)
  }
  return out
}

function parseKeysField(raw: unknown): string[] {
  if (Array.isArray(raw)) return asStringList(raw)
  const s = String(raw ?? '').trim()
  if (!s) return []
  return asStringList(s.split(/[\n,]+/))
}

function parseOptionalDate(raw: unknown): Date | null {
  if (raw == null || raw === '') return null
  if (raw instanceof Date && Number.isFinite(raw.getTime())) return raw
  const s = String(raw).trim()
  if (!s) return null
  const d = new Date(s.includes('T') ? s : `${s}T00:00:00.000Z`)
  return Number.isFinite(d.getTime()) ? d : null
}

function mapPackage(row: typeof sfAdsPackages.$inferSelect): AdsPackageRecord {
  return {
    id: row.id,
    title: row.title?.trim() || '',
    description: row.description ?? '',
    price:
      typeof row.price === 'number' && Number.isFinite(row.price) ? Math.floor(row.price) : 0,
    creditGrant:
      typeof row.creditGrant === 'number' && Number.isFinite(row.creditGrant)
        ? Math.floor(row.creditGrant)
        : 0,
    active: row.active !== false,
    sortOrder:
      typeof row.sortOrder === 'number' && Number.isFinite(row.sortOrder)
        ? Math.floor(row.sortOrder)
        : 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapPlacement(row: typeof sfAdsPlacements.$inferSelect): AdsPlacementRecord {
  return {
    id: row.id,
    label: row.label?.trim() || '',
    key: row.key?.trim() || '',
    enabled: row.enabled !== false,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapCredit(row: typeof sfAdsCredits.$inferSelect): AdsCreditBalanceRecord {
  return {
    id: row.id,
    buyerUserId: row.buyerUserId,
    balance:
      typeof row.balance === 'number' && Number.isFinite(row.balance)
        ? Math.floor(row.balance)
        : 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapCampaign(row: typeof sfAdsCampaigns.$inferSelect): AdsCampaignRecord {
  const status: CampaignStatus = isCampaignStatus(row.status) ? row.status : 'draft'
  return {
    id: row.id,
    buyerUserId: row.buyerUserId ?? '',
    packageId: row.packageId,
    placementIds: asStringList(row.placementIds),
    startsAt: row.startsAt ?? null,
    endsAt: row.endsAt ?? null,
    status,
    creativeMediaId: row.creativeMediaId ?? '',
    copyTitle: row.copyTitle ?? '',
    copyBody: row.copyBody ?? '',
    socialPostId: (row.socialPostId || '').trim() || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function missingTableError(msg: string, table: string): string {
  if (/does not exist|relation/i.test(msg)) {
    return `${table} missing — run npm run db:migrate.`
  }
  return msg
}

export async function listPackages(): Promise<AdsPackageRecord[]> {
  try {
    const rows = await db
      .select()
      .from(sfAdsPackages)
      .orderBy(asc(sfAdsPackages.sortOrder), asc(sfAdsPackages.title))
    return rows.map(mapPackage)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_ads_packages|does not exist|relation/i.test(msg)) return []
    throw error
  }
}

export async function findPackageById(id: string): Promise<AdsPackageRecord | null> {
  const trimmed = id.trim()
  if (!trimmed) return null
  try {
    const rows = await db
      .select()
      .from(sfAdsPackages)
      .where(eq(sfAdsPackages.id, trimmed))
      .limit(1)
    const row = rows[0]
    return row ? mapPackage(row) : null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_ads_packages|does not exist|relation/i.test(msg)) return null
    throw error
  }
}

export async function createPackage(
  input: PackageFieldInput,
): Promise<{ ok: true; package: AdsPackageRecord } | { ok: false; error: string }> {
  const validated = validatePackageFields(input)
  if (!validated.ok) return validated
  const id = newId('apkg')
  try {
    await db.insert(sfAdsPackages).values({ id, ...validated.values })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { ok: false, error: missingTableError(msg, 'sf_ads_packages') }
  }
  const row = await findPackageById(id)
  if (!row) return { ok: false, error: 'Package create failed.' }
  return { ok: true, package: row }
}

export async function updatePackage(
  input: PackageFieldInput & { id: string },
): Promise<{ ok: true; package: AdsPackageRecord } | { ok: false; error: string }> {
  const id = String(input.id ?? '').trim()
  if (!id) return { ok: false, error: 'Missing package id.' }
  const existing = await findPackageById(id)
  if (!existing) return { ok: false, error: 'Package not found.' }
  const validated = validatePackageFields(input, existing)
  if (!validated.ok) return validated
  try {
    await db
      .update(sfAdsPackages)
      .set({ ...validated.values, updatedAt: new Date() })
      .where(eq(sfAdsPackages.id, id))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { ok: false, error: msg }
  }
  const row = await findPackageById(id)
  if (!row) return { ok: false, error: 'Package update failed.' }
  return { ok: true, package: row }
}

export async function deletePackage(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = id.trim()
  if (!trimmed) return { ok: false, error: 'Missing package id.' }
  try {
    await db.delete(sfAdsPackages).where(eq(sfAdsPackages.id, trimmed))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/foreign key|restrict/i.test(msg)) {
      return { ok: false, error: 'Package is used by a campaign and cannot be deleted.' }
    }
    return { ok: false, error: missingTableError(msg, 'sf_ads_packages') }
  }
  return { ok: true }
}

export async function listPlacements(): Promise<AdsPlacementRecord[]> {
  try {
    const rows = await db
      .select()
      .from(sfAdsPlacements)
      .orderBy(asc(sfAdsPlacements.label))
    return rows.map(mapPlacement)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_ads_placements|does not exist|relation/i.test(msg)) return []
    throw error
  }
}

export async function findPlacementById(id: string): Promise<AdsPlacementRecord | null> {
  const trimmed = id.trim()
  if (!trimmed) return null
  try {
    const rows = await db
      .select()
      .from(sfAdsPlacements)
      .where(eq(sfAdsPlacements.id, trimmed))
      .limit(1)
    const row = rows[0]
    return row ? mapPlacement(row) : null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_ads_placements|does not exist|relation/i.test(msg)) return null
    throw error
  }
}

export async function createPlacement(
  input: PlacementFieldInput,
): Promise<{ ok: true; placement: AdsPlacementRecord } | { ok: false; error: string }> {
  const validated = validatePlacementFields(input)
  if (!validated.ok) return validated
  const id = newId('aplc')
  try {
    await db.insert(sfAdsPlacements).values({ id, ...validated.values })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/unique|duplicate|sf_ads_placements_key/i.test(msg)) {
      return { ok: false, error: 'That placement key is already in use.' }
    }
    return { ok: false, error: missingTableError(msg, 'sf_ads_placements') }
  }
  const row = await findPlacementById(id)
  if (!row) return { ok: false, error: 'Placement create failed.' }
  return { ok: true, placement: row }
}

export async function updatePlacement(
  input: PlacementFieldInput & { id: string },
): Promise<{ ok: true; placement: AdsPlacementRecord } | { ok: false; error: string }> {
  const id = String(input.id ?? '').trim()
  if (!id) return { ok: false, error: 'Missing placement id.' }
  const existing = await findPlacementById(id)
  if (!existing) return { ok: false, error: 'Placement not found.' }
  const validated = validatePlacementFields(input, existing)
  if (!validated.ok) return validated
  try {
    await db
      .update(sfAdsPlacements)
      .set({ ...validated.values, updatedAt: new Date() })
      .where(eq(sfAdsPlacements.id, id))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/unique|duplicate|sf_ads_placements_key/i.test(msg)) {
      return { ok: false, error: 'That placement key is already in use.' }
    }
    return { ok: false, error: msg }
  }
  const row = await findPlacementById(id)
  if (!row) return { ok: false, error: 'Placement update failed.' }
  return { ok: true, placement: row }
}

export async function deletePlacement(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = id.trim()
  if (!trimmed) return { ok: false, error: 'Missing placement id.' }
  try {
    await db.delete(sfAdsPlacements).where(eq(sfAdsPlacements.id, trimmed))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { ok: false, error: missingTableError(msg, 'sf_ads_placements') }
  }
  return { ok: true }
}

export async function findCreditBalanceByBuyer(
  buyerUserId: string,
): Promise<AdsCreditBalanceRecord | null> {
  const trimmed = buyerUserId.trim()
  if (!trimmed) return null
  try {
    const rows = await db
      .select()
      .from(sfAdsCredits)
      .where(eq(sfAdsCredits.buyerUserId, trimmed))
      .limit(1)
    const row = rows[0]
    return row ? mapCredit(row) : null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_ads_credits|does not exist|relation/i.test(msg)) return null
    throw error
  }
}

export async function listCampaigns(): Promise<AdsCampaignRecord[]> {
  try {
    const rows = await db
      .select()
      .from(sfAdsCampaigns)
      .orderBy(asc(sfAdsCampaigns.createdAt))
    return rows.map(mapCampaign)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_ads_campaigns|does not exist|relation/i.test(msg)) return []
    throw error
  }
}

export async function findCampaignById(id: string): Promise<AdsCampaignRecord | null> {
  const trimmed = id.trim()
  if (!trimmed) return null
  try {
    const rows = await db
      .select()
      .from(sfAdsCampaigns)
      .where(eq(sfAdsCampaigns.id, trimmed))
      .limit(1)
    const row = rows[0]
    return row ? mapCampaign(row) : null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (/sf_ads_campaigns|does not exist|relation/i.test(msg)) return null
    throw error
  }
}

export type SaveCampaignInput = {
  id?: string
  buyerUserId?: unknown
  packageId?: unknown
  placementIds?: unknown
  startsAt?: unknown
  endsAt?: unknown
  status?: unknown
  creativeMediaId?: unknown
  copyTitle?: unknown
  copyBody?: unknown
}

function campaignValuesFromInput(
  input: SaveCampaignInput,
  existing?: AdsCampaignRecord,
): { ok: true; values: Omit<AdsCampaignRecord, 'id' | 'socialPostId' | 'createdAt' | 'updatedAt'> } | {
  ok: false
  error: string
} {
  const packageId = String(input.packageId ?? existing?.packageId ?? '').trim()
  if (!packageId) return { ok: false, error: 'Package is required.' }

  const statusRaw = input.status !== undefined ? input.status : existing?.status ?? 'draft'
  const status: CampaignStatus = isCampaignStatus(statusRaw) ? statusRaw : 'draft'
  // Slice 2: no go-live / Social publish — refuse setting live here.
  if (status === 'live' && existing?.status !== 'live') {
    return {
      ok: false,
      error: 'Go-live is not available yet. Keep the campaign as draft, pending, or offline.',
    }
  }

  return {
    ok: true,
    values: {
      buyerUserId: String(input.buyerUserId ?? existing?.buyerUserId ?? '').trim(),
      packageId,
      placementIds:
        input.placementIds !== undefined
          ? parseKeysField(input.placementIds)
          : (existing?.placementIds ?? []),
      startsAt: parseOptionalDate(
        input.startsAt !== undefined ? input.startsAt : existing?.startsAt,
      ),
      endsAt: parseOptionalDate(input.endsAt !== undefined ? input.endsAt : existing?.endsAt),
      status,
      creativeMediaId: String(
        input.creativeMediaId ?? existing?.creativeMediaId ?? '',
      ).trim(),
      copyTitle: String(input.copyTitle ?? existing?.copyTitle ?? '').trim(),
      copyBody: String(input.copyBody ?? existing?.copyBody ?? '').trim(),
    },
  }
}

export async function createCampaign(
  input: SaveCampaignInput,
): Promise<{ ok: true; campaign: AdsCampaignRecord } | { ok: false; error: string }> {
  const validated = campaignValuesFromInput(input)
  if (!validated.ok) return validated
  const pkg = await findPackageById(validated.values.packageId)
  if (!pkg) return { ok: false, error: 'Package not found.' }
  const id = newId('acamp')
  try {
    await db.insert(sfAdsCampaigns).values({
      id,
      ...validated.values,
      socialPostId: null,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { ok: false, error: missingTableError(msg, 'sf_ads_campaigns') }
  }
  const row = await findCampaignById(id)
  if (!row) return { ok: false, error: 'Campaign create failed.' }
  return { ok: true, campaign: row }
}

export async function updateCampaign(
  input: SaveCampaignInput & { id: string },
): Promise<{ ok: true; campaign: AdsCampaignRecord } | { ok: false; error: string }> {
  const id = String(input.id ?? '').trim()
  if (!id) return { ok: false, error: 'Missing campaign id.' }
  const existing = await findCampaignById(id)
  if (!existing) return { ok: false, error: 'Campaign not found.' }
  const validated = campaignValuesFromInput(input, existing)
  if (!validated.ok) return validated
  const pkg = await findPackageById(validated.values.packageId)
  if (!pkg) return { ok: false, error: 'Package not found.' }
  try {
    await db
      .update(sfAdsCampaigns)
      .set({ ...validated.values, updatedAt: new Date() })
      .where(eq(sfAdsCampaigns.id, id))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { ok: false, error: msg }
  }
  const row = await findCampaignById(id)
  if (!row) return { ok: false, error: 'Campaign update failed.' }
  return { ok: true, campaign: row }
}

export async function deleteCampaign(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = id.trim()
  if (!trimmed) return { ok: false, error: 'Missing campaign id.' }
  try {
    await db.delete(sfAdsCampaigns).where(eq(sfAdsCampaigns.id, trimmed))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { ok: false, error: missingTableError(msg, 'sf_ads_campaigns') }
  }
  return { ok: true }
}
