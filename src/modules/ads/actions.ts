'use server'

import { revalidatePath } from '@/core/content/defer-revalidate'

import { requireAdminArea } from '@/core/acl/access'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import {
  createCampaign,
  createPackage,
  createPlacement,
  deleteCampaign,
  deletePackage,
  deletePlacement,
  updateCampaign,
  updatePackage,
  updatePlacement,
} from './store'

export type AdsActionState = {
  error?: string
  ok?: boolean
  message?: string
}

async function requireAdsAdmin(): Promise<AdsActionState | null> {
  const session = await requireAdminArea('admin.ads', 'edit')
  if (!session) {
    return {
      error: 'Sign in with Ads admin access (app admin or ACL → Ads) to manage the catalog.',
    }
  }
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.ads)) {
    return { error: 'Ads is disabled. Enable it under Settings → Modules.' }
  }
  return null
}

function revalidateAdsAdmin() {
  revalidatePath('/admin/ads')
  revalidatePath('/admin/ads/placements')
  revalidatePath('/admin/ads/campaigns')
}

export async function createPackageAction(
  _prev: AdsActionState,
  formData: FormData,
): Promise<AdsActionState> {
  const denied = await requireAdsAdmin()
  if (denied) return denied

  const result = await createPackage({
    title: formData.get('title'),
    description: formData.get('description'),
    price: formData.get('price'),
    creditGrant: formData.get('creditGrant'),
    active: formData.get('active') === '1',
    sortOrder: formData.get('sortOrder'),
  })
  if (!result.ok) return { error: result.error }
  revalidateAdsAdmin()
  return { ok: true }
}

export async function updatePackageAction(
  _prev: AdsActionState,
  formData: FormData,
): Promise<AdsActionState> {
  const denied = await requireAdsAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Missing package id.' }

  const result = await updatePackage({
    id,
    title: formData.get('title'),
    description: formData.get('description'),
    price: formData.get('price'),
    creditGrant: formData.get('creditGrant'),
    active: formData.get('active') === '1',
    sortOrder: formData.get('sortOrder'),
  })
  if (!result.ok) return { error: result.error }
  revalidateAdsAdmin()
  return { ok: true }
}

export async function deletePackageAction(
  _prev: AdsActionState,
  formData: FormData,
): Promise<AdsActionState> {
  const denied = await requireAdsAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Missing package id.' }
  const result = await deletePackage(id)
  if (!result.ok) return { error: result.error }
  revalidateAdsAdmin()
  return { ok: true }
}

export async function createPlacementAction(
  _prev: AdsActionState,
  formData: FormData,
): Promise<AdsActionState> {
  const denied = await requireAdsAdmin()
  if (denied) return denied

  const result = await createPlacement({
    label: formData.get('label'),
    key: formData.get('key'),
    enabled: formData.get('enabled') === '1',
  })
  if (!result.ok) return { error: result.error }
  revalidateAdsAdmin()
  return { ok: true }
}

export async function updatePlacementAction(
  _prev: AdsActionState,
  formData: FormData,
): Promise<AdsActionState> {
  const denied = await requireAdsAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Missing placement id.' }

  const result = await updatePlacement({
    id,
    label: formData.get('label'),
    key: formData.get('key'),
    enabled: formData.get('enabled') === '1',
  })
  if (!result.ok) return { error: result.error }
  revalidateAdsAdmin()
  return { ok: true }
}

export async function deletePlacementAction(
  _prev: AdsActionState,
  formData: FormData,
): Promise<AdsActionState> {
  const denied = await requireAdsAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Missing placement id.' }
  const result = await deletePlacement(id)
  if (!result.ok) return { error: result.error }
  revalidateAdsAdmin()
  return { ok: true }
}

export async function createCampaignAction(
  _prev: AdsActionState,
  formData: FormData,
): Promise<AdsActionState> {
  const denied = await requireAdsAdmin()
  if (denied) return denied

  const result = await createCampaign({
    buyerUserId: formData.get('buyerUserId'),
    packageId: formData.get('packageId'),
    placementIds: formData.getAll('placementIds'),
    startsAt: formData.get('startsAt'),
    endsAt: formData.get('endsAt'),
    status: formData.get('status'),
    creativeMediaId: formData.get('creativeMediaId'),
    copyTitle: formData.get('copyTitle'),
    copyBody: formData.get('copyBody'),
  })
  if (!result.ok) return { error: result.error }
  revalidateAdsAdmin()
  return { ok: true }
}

export async function updateCampaignAction(
  _prev: AdsActionState,
  formData: FormData,
): Promise<AdsActionState> {
  const denied = await requireAdsAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Missing campaign id.' }

  const result = await updateCampaign({
    id,
    buyerUserId: formData.get('buyerUserId'),
    packageId: formData.get('packageId'),
    placementIds: formData.getAll('placementIds'),
    startsAt: formData.get('startsAt'),
    endsAt: formData.get('endsAt'),
    status: formData.get('status'),
    creativeMediaId: formData.get('creativeMediaId'),
    copyTitle: formData.get('copyTitle'),
    copyBody: formData.get('copyBody'),
  })
  if (!result.ok) return { error: result.error }
  revalidateAdsAdmin()
  return { ok: true }
}

export async function deleteCampaignAction(
  _prev: AdsActionState,
  formData: FormData,
): Promise<AdsActionState> {
  const denied = await requireAdsAdmin()
  if (denied) return denied

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return { error: 'Missing campaign id.' }
  const result = await deleteCampaign(id)
  if (!result.ok) return { error: result.error }
  revalidateAdsAdmin()
  return { ok: true }
}
