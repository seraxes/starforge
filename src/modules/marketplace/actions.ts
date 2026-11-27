'use server'

import { revalidatePath } from '@/core/content/defer-revalidate'
import {
  getAccessViewer,
  requireAdminArea,
  viewerMayAccessAdminResource,
} from '@/core/acl/access'
import { normalizeLocaleTextMap, type LocaleTextMap } from '@/core/i18n/locale-text'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import {
  createMarketplaceCategory,
  deleteMarketplaceCategory,
  updateMarketplaceCategory,
} from './categories'
import { runMarketplaceDoor } from './door'
import {
  createMarketplaceListing,
  hideMarketplaceListing,
  markMarketplaceListingPending,
  markMarketplaceListingSold,
  removeMarketplaceListing,
  renewMarketplaceListing,
  restoreMarketplaceListing,
  updateMarketplaceListing,
} from './listings'
import { saveMarketplaceModuleSettings } from './settings'

export type MarketplaceAdminActionState = {
  error?: string
  ok?: boolean
  message?: string
  id?: string
}

async function requireMarketplaceAdmin(): Promise<MarketplaceAdminActionState | null> {
  const session = await requireAdminArea('admin.marketplace', 'edit')
  if (!session) {
    return {
      error:
        'Sign in with Marketplace admin access (app admin or ACL → Marketplace) to manage this area.',
    }
  }
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.marketplace)) {
    return { error: 'Marketplace is disabled. Enable it under Settings → Modules.' }
  }
  return null
}

async function marketplaceStaffActor(): Promise<
  | { ok: true; actor: { userId: string; isStaff: true } }
  | { ok: false; error: string }
> {
  const denied = await requireMarketplaceAdmin()
  if (denied) return { ok: false, error: denied.error || 'Access denied.' }
  const viewer = await getAccessViewer()
  const userId = viewer.userId?.trim() || ''
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const isStaff =
    viewer.isAppAdmin ||
    (await viewerMayAccessAdminResource(viewer, 'admin.marketplace', 'edit'))
  if (!isStaff) {
    return { ok: false, error: 'Marketplace staff access required.' }
  }
  return { ok: true, actor: { userId, isStaff: true } }
}

function revalidateMarketplaceAdmin() {
  revalidatePath('/admin/marketplace')
  revalidatePath('/admin/marketplace/listings')
  revalidatePath('/admin/marketplace/settings')
}

function parseLocaleMap(formData: FormData, key: string): LocaleTextMap {
  const raw = String(formData.get(key) ?? '').trim()
  if (!raw) return {}
  try {
    return normalizeLocaleTextMap(JSON.parse(raw) as unknown)
  } catch {
    return {}
  }
}

function categoryFieldsFromForm(formData: FormData) {
  return {
    title: String(formData.get('title') ?? ''),
    slug: String(formData.get('slug') ?? ''),
    description: String(formData.get('description') ?? ''),
    parentId: String(formData.get('parentId') ?? ''),
    enabled: formData.get('enabled') === '0' ? '0' : '1',
    sortOrder: String(formData.get('sortOrder') ?? '0'),
    titleLocales: parseLocaleMap(formData, 'titleLocales'),
    descriptionLocales: parseLocaleMap(formData, 'descriptionLocales'),
  }
}

export async function createMarketplaceCategoryAction(
  _prev: MarketplaceAdminActionState,
  formData: FormData,
): Promise<MarketplaceAdminActionState> {
  const denied = await requireMarketplaceAdmin()
  if (denied) return denied
  const result = await createMarketplaceCategory(categoryFieldsFromForm(formData))
  if ('error' in result) return { error: result.error }
  revalidateMarketplaceAdmin()
  return {
    ok: true,
    message: `Category “${result.category.title}” created.`,
    id: result.category.id,
  }
}

export async function updateMarketplaceCategoryAction(
  _prev: MarketplaceAdminActionState,
  formData: FormData,
): Promise<MarketplaceAdminActionState> {
  const denied = await requireMarketplaceAdmin()
  if (denied) return denied
  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Missing category id.' }
  const result = await updateMarketplaceCategory({
    id,
    ...categoryFieldsFromForm(formData),
  })
  if ('error' in result) return { error: result.error }
  revalidateMarketplaceAdmin()
  return {
    ok: true,
    message: `Category “${result.category.title}” saved.`,
    id: result.category.id,
  }
}

export async function deleteMarketplaceCategoryAction(
  _prev: MarketplaceAdminActionState,
  formData: FormData,
): Promise<MarketplaceAdminActionState> {
  const denied = await requireMarketplaceAdmin()
  if (denied) return denied
  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Missing category id.' }
  const result = await deleteMarketplaceCategory(id)
  if ('error' in result) return { error: result.error }
  revalidateMarketplaceAdmin()
  return { ok: true, message: 'Category deleted.' }
}

export async function saveMarketplaceSettingsAction(
  _prev: MarketplaceAdminActionState,
  formData: FormData,
): Promise<MarketplaceAdminActionState> {
  const denied = await requireMarketplaceAdmin()
  if (denied) return denied

  try {
    const settings = await saveMarketplaceModuleSettings({
      expiryDays: Number(formData.get('expiryDays') ?? 30),
      photoCap: Number(formData.get('photoCap') ?? 10),
      offersEnabled: formData.get('offersEnabled') === '1',
      listingFeeEnabled: formData.get('listingFeeEnabled') === '1',
      listingFeeMinor: Number(formData.get('listingFeeMinor') ?? 0),
    })
    revalidateMarketplaceAdmin()
    return {
      ok: true,
      message: `Marketplace settings saved (expiry ${settings.expiryDays} days, photo cap ${settings.photoCap}).`,
    }
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Could not save Marketplace settings.',
    }
  }
}

export async function hideMarketplaceListingAction(
  _prev: MarketplaceAdminActionState,
  formData: FormData,
): Promise<MarketplaceAdminActionState> {
  const staff = await marketplaceStaffActor()
  if (!staff.ok) return { error: staff.error }
  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Missing listing id.' }
  const result = await hideMarketplaceListing(id, staff.actor)
  if ('error' in result) return { error: result.error }
  revalidateMarketplaceAdmin()
  return { ok: true, message: `Listing “${result.listing.title}” hidden.`, id }
}

export async function removeMarketplaceListingAction(
  _prev: MarketplaceAdminActionState,
  formData: FormData,
): Promise<MarketplaceAdminActionState> {
  const staff = await marketplaceStaffActor()
  if (!staff.ok) return { error: staff.error }
  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Missing listing id.' }
  const result = await removeMarketplaceListing(id, staff.actor)
  if ('error' in result) return { error: result.error }
  revalidateMarketplaceAdmin()
  return { ok: true, message: `Listing “${result.listing.title}” removed.`, id }
}

export async function restoreMarketplaceListingAction(
  _prev: MarketplaceAdminActionState,
  formData: FormData,
): Promise<MarketplaceAdminActionState> {
  const staff = await marketplaceStaffActor()
  if (!staff.ok) return { error: staff.error }
  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Missing listing id.' }
  const result = await restoreMarketplaceListing(id, staff.actor)
  if ('error' in result) return { error: result.error }
  revalidateMarketplaceAdmin()
  return { ok: true, message: `Listing “${result.listing.title}” restored.`, id }
}

export type MarketplaceMemberActionState = {
  error?: string
  ok?: boolean
  message?: string
  id?: string
}

async function marketplaceEnabled(): Promise<boolean> {
  const settings = await getSiteSettings()
  return isCatalogModuleEnabled(settings, MODULE_IDS.marketplace)
}

async function marketplaceMemberActor(): Promise<
  | { ok: true; actor: { userId: string; isStaff: boolean } }
  | { ok: false; error: string }
> {
  const viewer = await getAccessViewer()
  const userId = viewer.userId?.trim() || ''
  if (!userId) return { ok: false, error: 'Sign in to manage Marketplace listings.' }
  const isStaff =
    viewer.isAppAdmin ||
    (await viewerMayAccessAdminResource(viewer, 'admin.marketplace', 'edit'))
  return { ok: true, actor: { userId, isStaff } }
}

function parseMediaIdsJson(raw: FormDataEntryValue | null): string[] {
  const text = String(raw ?? '').trim()
  if (!text) return []
  try {
    const parsed = JSON.parse(text) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map((id) => String(id ?? '').trim()).filter(Boolean)
  } catch {
    return []
  }
}

function listingFieldsFromForm(formData: FormData) {
  const priceRaw = String(formData.get('priceMinor') ?? '').trim()
  const free = formData.get('free') === '1' || priceRaw.toLowerCase() === 'free'
  return {
    title: String(formData.get('title') ?? ''),
    description: String(formData.get('description') ?? ''),
    condition: String(formData.get('condition') ?? ''),
    priceMinor: free ? null : priceRaw === '' ? null : Number(priceRaw),
    mediaIds: parseMediaIdsJson(formData.get('mediaIdsJson')),
    categoryId: String(formData.get('categoryId') ?? ''),
    areaLabel: String(formData.get('areaLabel') ?? ''),
    latitude: String(formData.get('latitude') ?? ''),
    longitude: String(formData.get('longitude') ?? ''),
  }
}

function revalidateMarketplacePublic(listingId?: string) {
  revalidatePath('/marketplace')
  revalidatePath('/marketplace/you')
  revalidatePath('/marketplace/new')
  if (listingId) {
    revalidatePath(`/marketplace/${listingId}`)
    revalidatePath(`/marketplace/${listingId}/edit`)
  }
  revalidateMarketplaceAdmin()
}

export async function createMarketplaceListingAction(
  _prev: MarketplaceMemberActionState,
  formData: FormData,
): Promise<MarketplaceMemberActionState> {
  const door = await runMarketplaceDoor(marketplaceEnabled, async () => {
    const member = await marketplaceMemberActor()
    if (!member.ok) return { error: member.error } as MarketplaceMemberActionState
    const result = await createMarketplaceListing(
      member.actor.userId,
      listingFieldsFromForm(formData),
    )
    if ('error' in result) return { error: result.error }
    revalidateMarketplacePublic(result.listing.id)
    return {
      ok: true,
      message: `Listing “${result.listing.title}” published.`,
      id: result.listing.id,
    }
  })
  if (!door.ok) return { error: 'Marketplace is disabled.' }
  return door.value
}

export async function updateMarketplaceListingAction(
  _prev: MarketplaceMemberActionState,
  formData: FormData,
): Promise<MarketplaceMemberActionState> {
  const door = await runMarketplaceDoor(marketplaceEnabled, async () => {
    const member = await marketplaceMemberActor()
    if (!member.ok) return { error: member.error } as MarketplaceMemberActionState
    const id = String(formData.get('id') ?? '').trim()
    if (!id) return { error: 'Missing listing id.' }
    const result = await updateMarketplaceListing(
      id,
      member.actor,
      listingFieldsFromForm(formData),
    )
    if ('error' in result) return { error: result.error }
    revalidateMarketplacePublic(result.listing.id)
    return {
      ok: true,
      message: `Listing “${result.listing.title}” saved.`,
      id: result.listing.id,
    }
  })
  if (!door.ok) return { error: 'Marketplace is disabled.' }
  return door.value
}

export async function markMarketplaceListingPendingAction(
  _prev: MarketplaceMemberActionState,
  formData: FormData,
): Promise<MarketplaceMemberActionState> {
  const door = await runMarketplaceDoor(marketplaceEnabled, async () => {
    const member = await marketplaceMemberActor()
    if (!member.ok) return { error: member.error } as MarketplaceMemberActionState
    const id = String(formData.get('id') ?? '').trim()
    if (!id) return { error: 'Missing listing id.' }
    const result = await markMarketplaceListingPending(id, member.actor)
    if ('error' in result) return { error: result.error }
    revalidateMarketplacePublic(result.listing.id)
    return {
      ok: true,
      message: `Listing “${result.listing.title}” marked pending.`,
      id,
    }
  })
  if (!door.ok) return { error: 'Marketplace is disabled.' }
  return door.value
}

export async function markMarketplaceListingSoldAction(
  _prev: MarketplaceMemberActionState,
  formData: FormData,
): Promise<MarketplaceMemberActionState> {
  const door = await runMarketplaceDoor(marketplaceEnabled, async () => {
    const member = await marketplaceMemberActor()
    if (!member.ok) return { error: member.error } as MarketplaceMemberActionState
    const id = String(formData.get('id') ?? '').trim()
    if (!id) return { error: 'Missing listing id.' }
    const soldToUserId = String(formData.get('soldToUserId') ?? '').trim() || null
    const result = await markMarketplaceListingSold(id, member.actor, soldToUserId)
    if ('error' in result) return { error: result.error }
    revalidateMarketplacePublic(result.listing.id)
    return {
      ok: true,
      message: `Listing “${result.listing.title}” marked sold.`,
      id,
    }
  })
  if (!door.ok) return { error: 'Marketplace is disabled.' }
  return door.value
}

export async function renewMarketplaceListingAction(
  _prev: MarketplaceMemberActionState,
  formData: FormData,
): Promise<MarketplaceMemberActionState> {
  const door = await runMarketplaceDoor(marketplaceEnabled, async () => {
    const member = await marketplaceMemberActor()
    if (!member.ok) return { error: member.error } as MarketplaceMemberActionState
    const id = String(formData.get('id') ?? '').trim()
    if (!id) return { error: 'Missing listing id.' }
    const result = await renewMarketplaceListing(id, member.actor)
    if ('error' in result) return { error: result.error }
    revalidateMarketplacePublic(result.listing.id)
    return {
      ok: true,
      message: `Listing “${result.listing.title}” renewed.`,
      id,
    }
  })
  if (!door.ok) return { error: 'Marketplace is disabled.' }
  return door.value
}

export async function hideOwnMarketplaceListingAction(
  _prev: MarketplaceMemberActionState,
  formData: FormData,
): Promise<MarketplaceMemberActionState> {
  const door = await runMarketplaceDoor(marketplaceEnabled, async () => {
    const member = await marketplaceMemberActor()
    if (!member.ok) return { error: member.error } as MarketplaceMemberActionState
    const id = String(formData.get('id') ?? '').trim()
    if (!id) return { error: 'Missing listing id.' }
    const result = await hideMarketplaceListing(id, member.actor)
    if ('error' in result) return { error: result.error }
    revalidateMarketplacePublic(result.listing.id)
    return {
      ok: true,
      message: `Listing “${result.listing.title}” hidden.`,
      id,
    }
  })
  if (!door.ok) return { error: 'Marketplace is disabled.' }
  return door.value
}
