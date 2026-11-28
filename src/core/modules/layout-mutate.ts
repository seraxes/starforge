import 'server-only'

import { revalidatePath } from '@/core/content/defer-revalidate'

import { requireAdminArea } from '@/core/acl/access'
import type { AclGrantLevel } from '@/core/acl/levels'
import { DEFAULT_LAYOUT_ID } from '@/core/db'

import { cloneWorkingLayoutDocument } from './document'
import { ensureDocumentEmptyRows } from './empty-rows'
import { resolveLayoutInheritance } from './inherit'
import { loadLayoutDocument, saveLayoutDocument } from './layout-store'
import { syncRowContainers } from './row-container'
import type { LayoutDocument, LayoutInheritMode, LayoutSlotConfig } from './types'

/**
 * Single save path for layout document actions.
 * Not a Server Action module: no `'use server'`, and not exported from `index.ts`.
 */

export function assignSyncedRowContainers(doc: LayoutDocument) {
  const next = syncRowContainers(doc.sections, doc.rowContainers, { createMissing: true })
  if (next && next.length > 0) doc.rowContainers = next
  else delete doc.rowContainers
}

export function asInheritModeForm(raw: unknown): LayoutInheritMode | null {
  const value = String(raw ?? '').trim().toLowerCase()
  if (value === 'inherit' || value === 'local') return value
  return null
}

/**
 * Explicit `inheritFrom`, or the active skin Base when this outline is not Base.
 * Pastel Social and other children often show Base as parent without a stored link.
 */
export async function parentOutlineId(doc: LayoutDocument, layoutId: string): Promise<string> {
  const { getActiveSkin } = await import('@/core/skin/resolve-active')
  const { outlineParentId } = await import('@/core/skin/outline-meta')
  const skin = await getActiveSkin()
  return outlineParentId(layoutId, doc.inheritFrom, skin.preferredDefaultOutlineId)
}

export async function loadParentResolved(
  doc: LayoutDocument,
  layoutId: string,
): Promise<LayoutDocument | null> {
  const inheritFrom = await parentOutlineId(doc, layoutId)
  if (!inheritFrom) return null
  return loadResolvedOutline(inheritFrom)
}

export function formSourceOutlineId(formData: FormData): string {
  return String(formData.get('sourceOutlineId') ?? '').trim()
}

export async function loadResolvedOutline(outlineId: string): Promise<LayoutDocument | null> {
  const id = outlineId.trim()
  if (!id) return null
  const loaded = await loadLayoutDocument(id)
  if (loaded.layoutId !== id && id !== DEFAULT_LAYOUT_ID) return null
  return resolveLayoutInheritance(loaded.layoutId, loaded.document)
}

export function storeOutlineSource(
  target: { inheritFromOutlineId?: string },
  sourceId: string,
  defaultParentId: string,
) {
  if (sourceId && sourceId !== defaultParentId) target.inheritFromOutlineId = sourceId
  else delete target.inheritFromOutlineId
}

/** Resolve outline id from form (`layoutId`) — defaults to Base Outline. */
export function layoutIdFromForm(formData: FormData | null | undefined): string {
  const raw = formData ? String(formData.get('layoutId') ?? '').trim() : ''
  return raw || DEFAULT_LAYOUT_ID
}

export type LayoutActionState = {
  error?: string
  ok?: boolean
  message?: string
  /** Saved particle config echoed for client hydrate after typed-slot saves. */
  config?: LayoutSlotConfig
  /** Saved HTML id / CSS class / particle CSS+JS echoed for client hydrate. */
  slotAttrs?: {
    htmlId?: string
    cssClass?: string
    particleCss?: string
    particleJs?: string
  }
}

export async function requireLayoutAdmin(
  min: AclGrantLevel = 'edit',
): Promise<LayoutActionState | null> {
  const admin = await requireAdminArea('admin.layouts', min)
  if (!admin) {
    return { error: 'Sign in with Layouts access (Users → ACL) or as an app admin.' }
  }
  return null
}

export function revalidateLayoutPaths(layoutId?: string) {
  // Includes the public root layout. Deferred so this save does not hard-reload `/`.
  revalidatePath('/', 'layout')
  revalidatePath('/admin/layouts')
  revalidatePath('/admin/breakpoints')
  revalidatePath('/admin/outlines')
  revalidatePath('/admin/page-settings')
  if (layoutId && layoutId !== DEFAULT_LAYOUT_ID) {
    revalidatePath(`/admin/layouts?outline=${encodeURIComponent(layoutId)}`)
    revalidatePath(`/admin/breakpoints?outline=${encodeURIComponent(layoutId)}`)
  }
}

export async function mutateLayout(
  formData: FormData,
  mutator: (doc: LayoutDocument) => LayoutDocument | { error: string },
): Promise<LayoutActionState> {
  const denied = await requireLayoutAdmin()
  if (denied) return denied

  const layoutId = layoutIdFromForm(formData)
  const { document } = await loadLayoutDocument(layoutId)
  const working = cloneWorkingLayoutDocument(document)

  const result = mutator(working)
  if ('error' in result) return { error: result.error }

  // Opt-in empty drop rows: collapse consecutive empties only (no auto-trailing).
  ensureDocumentEmptyRows(result)

  try {
    await saveLayoutDocument(result, layoutId)
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Could not save the layout document.'
    return { error: message }
  }

  revalidateLayoutPaths(layoutId)
  return { ok: true }
}

