'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAppAdmin } from '@/core/auth/admin'
import { DEFAULT_LAYOUT_ID } from '@/core/db'

import {
  createLayoutOutline,
  deleteLayoutOutline,
  duplicateLayoutOutline,
  renameLayoutOutline,
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
  revalidatePath('/app/admin/outlines')
  revalidatePath('/app/admin/layouts')
  revalidatePath('/app/admin/page-settings')
  if (outlineId) {
    revalidatePath(`/app/admin/layouts?outline=${encodeURIComponent(outlineId)}`)
  }
}

export async function createOutlineAction(
  _prev: OutlineActionState,
  formData: FormData,
): Promise<OutlineActionState> {
  const denied = await requireOutlineAdmin()
  if (denied) return denied

  const label = String(formData.get('label') ?? '').trim()
  const requestedId = String(formData.get('id') ?? '').trim()
  const copyFromId = String(formData.get('copyFromId') ?? '').trim()
  const openAfter = String(formData.get('openAfter') ?? '') === '1'

  const result = await createLayoutOutline({
    label,
    ...(requestedId ? { id: requestedId } : {}),
    ...(copyFromId ? { copyFromId } : {}),
  })

  if ('error' in result) return { error: result.error }

  revalidateOutlinePaths(result.outline.id)

  if (openAfter) {
    redirect(`/app/admin/layouts?outline=${encodeURIComponent(result.outline.id)}`)
  }

  return {
    ok: true,
    message: `Outline “${result.outline.label}” created.`,
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

  const sourceId = String(formData.get('sourceId') ?? '').trim() || DEFAULT_LAYOUT_ID
  const label = String(formData.get('label') ?? '').trim()
  const requestedId = String(formData.get('id') ?? '').trim()
  const openAfter = String(formData.get('openAfter') ?? '') === '1'

  const result = await duplicateLayoutOutline(sourceId, label, requestedId || undefined)
  if ('error' in result) return { error: result.error }

  revalidateOutlinePaths(result.outline.id)

  if (openAfter) {
    redirect(`/app/admin/layouts?outline=${encodeURIComponent(result.outline.id)}`)
  }

  return {
    ok: true,
    message: `Duplicated as “${result.outline.label}”.`,
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
