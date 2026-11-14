'use server'

import { revalidatePath } from '@/core/content/defer-revalidate'
import { redirect } from 'next/navigation'

import { requireAppAdmin } from '@/core/auth/admin'
import { DEFAULT_LAYOUT_ID } from '@/core/db'
import { getActiveSkin } from '@/core/skin'

import {
  createLayoutOutline,
  deleteLayoutOutline,
  duplicateLayoutOutline,
  renameLayoutOutline,
  setLayoutInheritFrom,
} from './layout-store'

export type OutlineActionState = {
  error?: string
  ok?: boolean
  message?: string
  outlineId?: string
}

async function requireOutlineAdmin(): Promise<OutlineActionState | null> {
  const admin = await requireAppAdmin()
  if (!admin) {
    return { error: 'Sign in as a Starforge app admin to manage outlines.' }
  }
  return null
}

function revalidateOutlinePaths(outlineId?: string) {
  revalidatePath('/', 'layout')
  revalidatePath('/admin/outlines')
  revalidatePath('/admin/layouts')
  revalidatePath('/admin/breakpoints')
  revalidatePath('/admin/page-settings')
  if (outlineId) {
    revalidatePath(`/admin/layouts?outline=${encodeURIComponent(outlineId)}`)
    revalidatePath(`/admin/breakpoints?outline=${encodeURIComponent(outlineId)}`)
  }
}

async function activeSkinContext(): Promise<{
  skinId: string
  baseOutlineId: string
}> {
  const skin = await getActiveSkin()
  const base =
    (typeof skin.preferredDefaultOutlineId === 'string' &&
      skin.preferredDefaultOutlineId.trim()) ||
    skin.outlineSeeds?.find((s) => s.defaultForSite)?.id ||
    skin.outlineSeeds?.[0]?.id ||
    DEFAULT_LAYOUT_ID
  return { skinId: skin.id, baseOutlineId: base }
}

export async function createOutlineAction(
  _prev: OutlineActionState,
  formData: FormData,
): Promise<OutlineActionState> {
  const denied = await requireOutlineAdmin()
  if (denied) return denied

  const { skinId, baseOutlineId } = await activeSkinContext()
  const label = String(formData.get('label') ?? '').trim()
  const requestedId = String(formData.get('id') ?? '').trim()
  // From: any outline (defaults to skin Base).
  const sourceId =
    String(formData.get('sourceId') ?? '').trim() ||
    String(formData.get('inheritFromId') ?? '').trim() ||
    String(formData.get('copyFromId') ?? '').trim() ||
    baseOutlineId
  // inherit = live child of source; copy = full resolved snapshot, no inherit link.
  const modeRaw = String(formData.get('createMode') ?? 'inherit').trim().toLowerCase()
  const mode = modeRaw === 'copy' ? 'copy' : 'inherit'
  const openAfter = String(formData.get('openAfter') ?? '') === '1'

  const result = await createLayoutOutline({
    label,
    ...(requestedId ? { id: requestedId } : {}),
    skinId,
    ...(mode === 'inherit'
      ? { inheritFromId: sourceId, asInheritingChild: true }
      : { copyFromId: sourceId, asInheritingChild: false }),
  })

  if ('error' in result) return { error: result.error }

  revalidateOutlinePaths(result.outline.id)

  if (openAfter) {
    redirect(`/admin/layouts?outline=${encodeURIComponent(result.outline.id)}`)
  }

  return {
    ok: true,
    message:
      mode === 'inherit'
        ? `Outline “${result.outline.label}” created under ${skinId} (inherits ${sourceId}).`
        : `Outline “${result.outline.label}” created under ${skinId} (copied from ${sourceId}).`,
    outlineId: result.outline.id,
  }
}

export async function renameOutlineAction(
  _prev: OutlineActionState,
  formData: FormData,
): Promise<OutlineActionState> {
  const denied = await requireOutlineAdmin()
  if (denied) return denied

  const layoutId = String(formData.get('layoutId') ?? '').trim() || DEFAULT_LAYOUT_ID
  const label = String(formData.get('label') ?? '').trim()

  const result = await renameLayoutOutline(layoutId, label)
  if ('error' in result) return { error: result.error }

  revalidateOutlinePaths(result.outline.id)
  return {
    ok: true,
    message: `Renamed to “${result.outline.label}”.`,
    outlineId: result.outline.id,
  }
}

export async function duplicateOutlineAction(
  _prev: OutlineActionState,
  formData: FormData,
): Promise<OutlineActionState> {
  const denied = await requireOutlineAdmin()
  if (denied) return denied

  const { skinId, baseOutlineId } = await activeSkinContext()
  const sourceId = String(formData.get('sourceId') ?? '').trim() || DEFAULT_LAYOUT_ID
  const label = String(formData.get('label') ?? '').trim()
  const requestedId = String(formData.get('id') ?? '').trim()
  // Default: inheriting child of Base (not a full snapshot root).
  const asInheritingChild = formData.has('asInheritingChild')
    ? String(formData.get('asInheritingChild') ?? '') === '1'
    : true
  const openAfter = String(formData.get('openAfter') ?? '') === '1'

  const result = await duplicateLayoutOutline(sourceId, label, requestedId || undefined, {
    asInheritingChild,
    skinId,
    skinBaseOutlineId: baseOutlineId,
  })
  if ('error' in result) return { error: result.error }

  revalidateOutlinePaths(result.outline.id)

  if (openAfter) {
    redirect(`/admin/layouts?outline=${encodeURIComponent(result.outline.id)}`)
  }

  return {
    ok: true,
    message: asInheritingChild
      ? `Created “${result.outline.label}” as inheriting child under ${skinId}.`
      : `Duplicated “${result.outline.label}” (full copy) under ${skinId}.`,
    outlineId: result.outline.id,
  }
}

export async function setOutlineInheritFromAction(
  _prev: OutlineActionState,
  formData: FormData,
): Promise<OutlineActionState> {
  const denied = await requireOutlineAdmin()
  if (denied) return denied

  const layoutId = String(formData.get('layoutId') ?? '').trim()
  if (!layoutId) return { error: 'Missing outline id.' }
  const inheritFromRaw = String(formData.get('inheritFromId') ?? '').trim()
  const inheritFromId = inheritFromRaw || null

  const result = await setLayoutInheritFrom(layoutId, inheritFromId)
  if ('error' in result) return { error: result.error }

  revalidateOutlinePaths(result.outline.id)
  return {
    ok: true,
    message: inheritFromId
      ? `“${result.outline.label}” now inherits from “${inheritFromId}”.`
      : `“${result.outline.label}” no longer inherits (standalone).`,
    outlineId: result.outline.id,
  }
}

export async function deleteOutlineAction(
  _prev: OutlineActionState,
  formData: FormData,
): Promise<OutlineActionState> {
  const denied = await requireOutlineAdmin()
  if (denied) return denied

  const layoutId = String(formData.get('layoutId') ?? '').trim()
  if (!layoutId) return { error: 'Missing outline id.' }

  const result = await deleteLayoutOutline(layoutId)
  if ('error' in result) return { error: result.error }

  revalidateOutlinePaths()
  return { ok: true, message: `Outline “${layoutId}” deleted.` }
}
