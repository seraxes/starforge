'use server'

import { revalidatePath } from '@/core/content/defer-revalidate'

import { requireAdminArea } from '@/core/acl'
import { listLayoutOutlines, loadLayoutDocument } from '@/core/modules/layout-store'

import { ensureSkinOutlineSeeds } from './outline-seeds'
import { installSkinPackToData } from './pack-io'
import { unzipSkinPack } from './pack-zip'
import {
  getSkin,
  invalidateSkinRegistry,
  isRegisteredSkinId,
  listSkins,
} from './registry'
import { isSkinPinnedByEnv } from './resolve-active'
import { saveDefaultSkinId } from './settings-store'
import type { SkinOutlineSeed } from './types'

export type SkinActionState = {
  ok?: boolean
  error?: string
  message?: string
  defaultSkinId?: string
  /** Preferred outline after switch — Layouts picker can navigate here. */
  preferredOutlineId?: string
}

export type SkinUploadActionState = {
  ok?: boolean
  error?: string
  message?: string
  skinId?: string
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
    revalidatePath('/admin/layouts')
    revalidatePath('/admin/breakpoints')
    revalidatePath('/admin/page-settings')
    revalidatePath('/admin/assigned-menu')
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

/** Collect live outline seeds for a skin (DB rows with matching skin_id, else pack seeds). */
export async function collectLiveOutlineSeedsForSkin(
  skinId: string,
): Promise<SkinOutlineSeed[]> {
  const skin = getSkin(skinId)
  const packSeeds = skin?.outlineSeeds ?? []
  try {
    const outlines = await listLayoutOutlines()
    const owned = outlines.filter((o) => o.skinId === skinId)
    if (owned.length === 0) return packSeeds

    const seeds: SkinOutlineSeed[] = []
    for (const meta of owned) {
      const { document } = await loadLayoutDocument(meta.id)
      const packSeed = packSeeds.find((s) => s.id === meta.id)
      seeds.push({
        id: meta.id,
        label: meta.label || packSeed?.label || meta.id,
        document,
        defaultForSite:
          packSeed?.defaultForSite ||
          meta.id === skin?.preferredDefaultOutlineId ||
          undefined,
      })
    }
    return seeds
  } catch {
    return packSeeds
  }
}

export async function uploadSkinPackAction(
  _prev: SkinUploadActionState,
  formData: FormData,
): Promise<SkinUploadActionState> {
  const denied = await requireLayoutsSkinAccess()
  if (denied) return { error: denied.error }

  const file = formData.get('pack')
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose a skin pack zip to upload.' }
  }
  if (file.size > 8 * 1024 * 1024) {
    return { error: 'Skin pack is too large (max 8 MB).' }
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const input = await unzipSkinPack(bytes)
    const installed = await installSkinPackToData(input)
    invalidateSkinRegistry()
    const seed = await ensureSkinOutlineSeeds(installed.id, {
      applyPreferredOutline: false,
    })
    revalidatePath('/admin/skins')
    revalidatePath('/admin/layouts')
    revalidatePath('/admin/breakpoints')
    revalidatePath('/admin/page-settings')
    revalidatePath('/', 'layout')
    const parts = [`Installed skin ${installed.label} (${installed.id}).`]
    if (seed.created.length > 0) {
      parts.push(`Seeded outline(s): ${seed.created.join(', ')}.`)
    }
    return { ok: true, message: parts.join(' '), skinId: installed.id }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not install skin pack.',
    }
  }
}
