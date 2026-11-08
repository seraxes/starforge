'use server'

import { revalidatePath } from 'next/cache'

import { requireAdminArea } from '@/core/acl'

import { ensureSkinOutlineSeeds } from './outline-seeds'
import { getSkin, isRegisteredSkinId, listSkins } from './registry'
import { isSkinPinnedByEnv } from './resolve-active'
import { saveDefaultSkinId } from './settings-store'

export type SkinActionState = {
  ok?: boolean
  error?: string
  message?: string
  defaultSkinId?: string
  /** Preferred outline after switch — Layouts picker can navigate here. */
  preferredOutlineId?: string
}

async function applyDefaultSkin(skinId: string): Promise<SkinActionState> {
  if (isSkinPinnedByEnv()) {
    return {
      error:
        'Active skin is pinned by STARFORGE_SKIN in the environment. Clear that env var to use the admin default.',
    }
  }

  const id = skinId.trim()
  if (!id || !isRegisteredSkinId(id)) {
    return { error: 'Choose a registered skin.' }
  }

  try {
    const saved = await saveDefaultSkinId(id)
    const seed = await ensureSkinOutlineSeeds(saved.defaultSkinId, {
      applyPreferredOutline: true,
    })
    revalidatePath('/admin/skins')
    revalidatePath('/admin/outlines')
    revalidatePath('/admin/layouts')
    revalidatePath('/admin/breakpoints')
    revalidatePath('/admin/particle-defaults')
    revalidatePath('/admin/page-settings')
    revalidatePath('/', 'layout')
    const label = listSkins().find((s) => s.id === saved.defaultSkinId)?.label ?? saved.defaultSkinId
    const preferred =
      seed.preferredOutlineId || getSkin(saved.defaultSkinId)?.preferredDefaultOutlineId || undefined
    const parts = [`Default skin set to ${label}.`]
    if (seed.created.length > 0) {
      parts.push(`Installed outline(s): ${seed.created.join(', ')}.`)
    }
    if (seed.globalLayoutIdUpdated && preferred) {
      parts.push(`Layouts site default outline → ${preferred}.`)
    }
    return {
      ok: true,
      message: parts.join(' '),
      defaultSkinId: saved.defaultSkinId,
      preferredOutlineId: preferred,
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not save default skin.',
    }
  }
}

async function requireLayoutsSkinAccess(): Promise<SkinActionState | null> {
  const session = await requireAdminArea('admin.layouts')
  if (!session?.user) {
    return { error: 'Sign in with Layouts admin access to manage skins.' }
  }
  return null
}

export async function setDefaultSkinAction(
  _prev: SkinActionState,
  formData: FormData,
): Promise<SkinActionState> {
  const denied = await requireLayoutsSkinAccess()
  if (denied) return denied
  return applyDefaultSkin(String(formData.get('skinId') ?? ''))
}

/** Layouts chrome Skin picker — same switch as Skins admin (`admin.layouts`). */
export async function switchSkinFromLayoutsAction(skinId: string): Promise<SkinActionState> {
  const denied = await requireLayoutsSkinAccess()
  if (denied) return denied
  return applyDefaultSkin(skinId)
}
