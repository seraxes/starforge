'use server'

import { revalidatePath } from 'next/cache'

import { accessTagsForStorage, normalizeAccessTags } from '@/core/acl/nav-access'
import { requireAppAdmin } from '@/core/auth/admin'
import { DEFAULT_LAYOUT_ID } from '@/core/db'
import { ensureModulesRegistered } from '@/core/modules/boot'

import {
  cloneDefaultLayoutDocument,
  findRow,
  findSection,
  findSlot,
  newLayoutEntityId,
  sanitizeCssClassList,
  sanitizeDisplayName,
  sanitizeHtmlId,
  slugifyLayoutId,
} from './document'
import {
  appendEmptyLayoutRow,
  ensureDocumentEmptyRows,
  ensureSectionEmptyRows,
  removeEmptyLayoutRow,
} from './empty-rows'
import { clampGridWidth, evenColumnWidths, LAYOUT_WIDTH_FULL, resizeAdjacentPair } from './grid'
import { copySectionFromParent, copySlotFromParent } from './inherit-merge'
import { resolveLayoutInheritance } from './inherit'
import { loadLayoutDocument, saveLayoutDocument } from './layout-store'
import { defaultConfigForModule } from './particles/config'
import { getRegisteredModule, listRegisteredModules } from './registry'
import {
  DEFAULT_LAYOUT_BREAKPOINTS,
  normalizeLayoutBreakpoints,
  normalizeLayoutSectionStyles,
  sanitizeBackgroundImageUrl,
  sanitizeBackgroundMediaId,
  sanitizeCssColor,
  sanitizeCssColorOrGradient,
  type LayoutBreakpoints,
  type LayoutContainerMode,
  type LayoutSectionStyles,
} from './styles'
import { resolveMediaById } from '@/core/media/resolve'
import type {
  LayoutDocument,
  LayoutInheritMode,
  LayoutRow,
  LayoutSection,
  LayoutSlot,
  LayoutSlotConfig,
} from './types'

function asInheritModeForm(raw: unknown): LayoutInheritMode | null {
  const value = String(raw ?? '').trim().toLowerCase()
  if (value === 'inherit' || value === 'local') return value
  return null
}

async function loadParentResolved(
  doc: LayoutDocument,
  layoutId: string,
): Promise<LayoutDocument | null> {
  const inheritFrom =
    typeof doc.inheritFrom === 'string' ? doc.inheritFrom.trim() : ''
  if (!inheritFrom || inheritFrom === layoutId) return null
  const { document: parentRaw, layoutId: parentId } = await loadLayoutDocument(inheritFrom)
  return resolveLayoutInheritance(parentId, parentRaw)
}

function findSlotInSection(
  section: LayoutSection | undefined,
  slotId: string,
): LayoutSlot | null {
  if (!section) return null
  for (const row of section.rows) {
    const slot = row.slots.find((s) => s.id === slotId)
    if (slot) return slot
  }
  return null
}

/** Resolve outline id from form (`layoutId`) — defaults to Base Outline. */
function layoutIdFromForm(formData: FormData | null | undefined): string {
  const raw = formData ? String(formData.get('layoutId') ?? '').trim() : ''
  return raw || DEFAULT_LAYOUT_ID
}

function makeSlot(moduleId: string, width: number, order: number): LayoutSlot {
  const config = defaultConfigForModule(moduleId)
  return {
    id: newLayoutEntityId(`slot-${moduleId}`),
    moduleId,
    width: clampGridWidth(width, LAYOUT_WIDTH_FULL),
    enabled: true,
    order,
    ...(config ? { config } : {}),
  }
}

function rebalanceRowSlots(row: LayoutRow): void {
  const widths = evenColumnWidths(row.slots.length)
  row.slots.forEach((slot, index) => {
    slot.width = widths[index] ?? 1
    slot.order = index
  })
}

export type LayoutActionState = {
  error?: string
  ok?: boolean
  message?: string
  /** Saved particle config echoed for client hydrate after typed-slot saves. */
  config?: LayoutSlotConfig
  /** Saved HTML id / CSS class echoed for client hydrate after attribute saves. */
  slotAttrs?: { htmlId?: string; cssClass?: string }
}

async function requireLayoutAdmin(): Promise<LayoutActionState | null> {
  const admin = await requireAppAdmin()
  if (!admin) {
    return { error: 'Sign in as a Starforge app admin to edit the layout.' }
  }
  return null
}

function revalidateLayoutPaths(layoutId?: string) {
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

async function mutateLayout(
  formData: FormData,
  mutator: (doc: LayoutDocument) => LayoutDocument | { error: string },
): Promise<LayoutActionState> {
  const denied = await requireLayoutAdmin()
  if (denied) return denied

  const layoutId = layoutIdFromForm(formData)
  const { document } = await loadLayoutDocument(layoutId)
  const working =
    document.sections.length > 0 ? structuredClone(document) : cloneDefaultLayoutDocument()

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

export async function addLayoutSectionAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const label = String(formData.get('label') ?? '').trim()
  if (!label) return { error: 'Section name is required.' }

  const requestedId = String(formData.get('id') ?? '').trim()
  const id = slugifyLayoutId(requestedId || label)
  const width = formData.has('width')
    ? clampGridWidth(formData.get('width'), LAYOUT_WIDTH_FULL)
    : LAYOUT_WIDTH_FULL

  const state = await mutateLayout(formData, (doc) => {
    if (doc.sections.some((s) => s.id === id)) {
      return { error: `Section id “${id}” already exists.` }
    }
    const maxOrder = doc.sections.reduce((m, s) => Math.max(m, s.order ?? 0), -1)
    const section: LayoutSection = {
      id,
      label,
      order: maxOrder + 1,
      width,
      rows: [
        {
          id: newLayoutEntityId(`${id}-row`),
          order: 0,
          slots: [],
        },
      ],
    }
    doc.sections.push(section)
    return doc
  })

  if (state.ok) state.message = `Section “${label}” added.`
  return state
}

export async function renameLayoutSectionAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const label = String(formData.get('label') ?? '').trim()
  if (!sectionId) return { error: 'Missing section id.' }
  if (!label) return { error: 'Section name is required.' }

  const state = await mutateLayout(formData, (doc) => {
    const section = findSection(doc, sectionId)
    if (!section) return { error: `Section “${sectionId}” not found.` }
    section.label = label
    return doc
  })

  if (state.ok) state.message = `Section renamed to “${label}”.`
  return state
}

/**
 * Permanently remove a section and everything inside it (rows + particles).
 * Refuses when it would leave the outline with zero sections.
 */
export async function removeLayoutSectionAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  if (!sectionId) return { error: 'Missing section id.' }

  let removedLabel = sectionId
  const state = await mutateLayout(formData, (doc) => {
    if (doc.sections.length <= 1) {
      return { error: 'Cannot remove the last section — add another first.' }
    }
    const section = findSection(doc, sectionId)
    if (!section) return { error: `Section “${sectionId}” not found.` }
    removedLabel = section.label || sectionId
    doc.sections = doc.sections
      .filter((s) => s.id !== sectionId)
      .map((s, index) => {
        s.order = index
        return s
      })
    return doc
  })

  if (state.ok) state.message = `Section “${removedLabel}” removed.`
  return state
}

function patchSectionStyles(
  current: LayoutSectionStyles | undefined,
  patch: Partial<LayoutSectionStyles> & {
    clearBackgroundColor?: boolean
    clearTextColor?: boolean
    clearBackgroundImage?: boolean
    clearBackgroundMediaId?: boolean
    clearOverlayColor?: boolean
    clearBackgroundOverlay?: boolean
    clearAllowGradientBackground?: boolean
    clearAllowGradientOverlay?: boolean
  },
): LayoutSectionStyles | undefined {
  const next: LayoutSectionStyles = { ...(current ?? {}) }
  if (patch.clearBackgroundColor) delete next.backgroundColor
  else if (patch.backgroundColor !== undefined) next.backgroundColor = patch.backgroundColor
  if (patch.clearTextColor) delete next.textColor
  else if (patch.textColor !== undefined) next.textColor = patch.textColor
  if (patch.clearBackgroundMediaId) delete next.backgroundMediaId
  else if (patch.backgroundMediaId !== undefined) next.backgroundMediaId = patch.backgroundMediaId
  if (patch.clearBackgroundImage) delete next.backgroundImage
  else if (patch.backgroundImage !== undefined) next.backgroundImage = patch.backgroundImage
  if (patch.clearBackgroundOverlay) delete next.backgroundOverlay
  else if (patch.backgroundOverlay !== undefined) next.backgroundOverlay = patch.backgroundOverlay
  if (patch.clearOverlayColor) delete next.overlayColor
  else if (patch.overlayColor !== undefined) next.overlayColor = patch.overlayColor
  if (patch.clearAllowGradientBackground) delete next.allowGradientBackground
  else if (patch.allowGradientBackground !== undefined) {
    next.allowGradientBackground = patch.allowGradientBackground
  }
  if (patch.clearAllowGradientOverlay) delete next.allowGradientOverlay
  else if (patch.allowGradientOverlay !== undefined) {
    next.allowGradientOverlay = patch.allowGradientOverlay
  }
  return normalizeLayoutSectionStyles(next)
}

/**
 * Persist section display name, CSS classes, container mode, and/or Section Styles
 * (background, text, image, overlay). Section `id` is never changed.
 * Empty cssClass / colors / image clear. Styles live on the section — deleting
 * the section removes its Styles entry automatically.
 */
export async function updateLayoutSectionMetaAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  if (!sectionId) return { error: 'Missing section id.' }

  const hasLabel = formData.has('label')
  const hasCssClass = formData.has('cssClass')
  const hasContainerMode = formData.has('containerMode')
  const hasWidth = formData.has('width')
  const hasBackgroundColor = formData.has('backgroundColor')
  const hasTextColor = formData.has('textColor')
  const hasBackgroundImage = formData.has('backgroundImage')
  const hasBackgroundMediaId = formData.has('backgroundMediaId')
  const hasBackgroundOverlay = formData.has('backgroundOverlay')
  const hasOverlayColor = formData.has('overlayColor')
  // Checkbox pair: hidden "0" + checkbox "1" — always present on Styles form saves.
  const hasAllowGradientBackground = formData.has('allowGradientBackground')
  const hasAllowGradientOverlay = formData.has('allowGradientOverlay')
  const stylesTouched =
    hasBackgroundColor ||
    hasTextColor ||
    hasBackgroundImage ||
    hasBackgroundMediaId ||
    hasBackgroundOverlay ||
    hasOverlayColor ||
    hasAllowGradientBackground ||
    hasAllowGradientOverlay
  if (!hasLabel && !hasCssClass && !hasContainerMode && !hasWidth && !stylesTouched) {
    return { error: 'Nothing to update on this section.' }
  }

  const label = hasLabel ? String(formData.get('label') ?? '').trim() : undefined
  if (hasLabel && !label) return { error: 'Section name is required.' }

  const cssClassRaw = hasCssClass ? String(formData.get('cssClass') ?? '') : undefined
  const cssClass = hasCssClass ? sanitizeCssClassList(cssClassRaw) : undefined

  let containerMode: LayoutContainerMode | undefined
  if (hasContainerMode) {
    const raw = String(formData.get('containerMode') ?? '').trim()
    if (raw !== 'full' && raw !== 'boxed') {
      return { error: 'Container mode must be full or boxed.' }
    }
    containerMode = raw
  }

  const width = hasWidth ? clampGridWidth(formData.get('width'), LAYOUT_WIDTH_FULL) : undefined

  const truthyFormFlag = (name: string): boolean => {
    const values = formData.getAll(name).map((v) => String(v).trim().toLowerCase())
    return values.some((v) => v === '1' || v === 'true' || v === 'on' || v === 'yes')
  }
  const allowGradientBackground = hasAllowGradientBackground
    ? truthyFormFlag('allowGradientBackground')
    : false
  const allowGradientOverlay = hasAllowGradientOverlay
    ? truthyFormFlag('allowGradientOverlay')
    : false

  const backgroundColorRaw = hasBackgroundColor
    ? String(formData.get('backgroundColor') ?? '').trim()
    : undefined
  const textColorRaw = hasTextColor ? String(formData.get('textColor') ?? '').trim() : undefined
  const backgroundImageRaw = hasBackgroundImage
    ? String(formData.get('backgroundImage') ?? '').trim()
    : undefined
  const backgroundMediaIdRaw = hasBackgroundMediaId
    ? String(formData.get('backgroundMediaId') ?? '').trim()
    : undefined
  const backgroundOverlayRaw = hasBackgroundOverlay
    ? String(formData.get('backgroundOverlay') ?? '').trim().toLowerCase()
    : undefined
  const overlayColorRaw = hasOverlayColor
    ? String(formData.get('overlayColor') ?? '').trim()
    : undefined

  if (hasBackgroundOverlay && backgroundOverlayRaw) {
    if (backgroundOverlayRaw !== 'enabled' && backgroundOverlayRaw !== 'disabled') {
      return { error: 'Background overlay must be enabled or disabled.' }
    }
  }

  // Resolve library id → URL before mutate so styles stay sync-renderable.
  let resolvedFromMedia: string | undefined
  if (hasBackgroundMediaId && backgroundMediaIdRaw) {
    const mediaId = sanitizeBackgroundMediaId(backgroundMediaIdRaw)
    if (!mediaId) {
      return { error: 'Background media id is invalid.' }
    }
    const resolved = await resolveMediaById(mediaId, { size: 'large', preferWebp: true })
    if (!resolved?.url) {
      return { error: 'Background media id was not found in the library.' }
    }
    resolvedFromMedia = resolved.url
  }

  const state = await mutateLayout(formData, (doc) => {
    const section = findSection(doc, sectionId)
    if (!section) return { error: `Section “${sectionId}” not found.` }
    if (hasLabel && label) section.label = label
    if (hasCssClass) {
      if (cssClass) section.cssClass = cssClass
      else delete section.cssClass
    }
    if (hasContainerMode && containerMode) {
      section.containerMode = containerMode
    }
    if (hasWidth && width != null) {
      section.width = width
    }
    if (stylesTouched) {
      const nextAllowBg = hasAllowGradientBackground
        ? allowGradientBackground
        : Boolean(section.styles?.allowGradientBackground)
      const nextAllowOverlay = hasAllowGradientOverlay
        ? allowGradientOverlay
        : Boolean(section.styles?.allowGradientOverlay)

      let backgroundColor: string | undefined
      let clearBackgroundColor = false
      if (hasBackgroundColor) {
        if (!backgroundColorRaw) {
          clearBackgroundColor = true
        } else {
          backgroundColor = sanitizeCssColorOrGradient(backgroundColorRaw, nextAllowBg)
          if (!backgroundColor) {
            return {
              error: nextAllowBg
                ? 'Background must be hex, transparent, or a CSS gradient.'
                : 'Background color must be a hex value (e.g. #18191c) or transparent.',
            }
          }
        }
      }

      let textColor: string | undefined
      let clearTextColor = false
      if (hasTextColor) {
        if (!textColorRaw) {
          clearTextColor = true
        } else {
          textColor = sanitizeCssColor(textColorRaw)
          if (!textColor) {
            return { error: 'Text color must be a hex value (e.g. #ffffff) or transparent.' }
          }
        }
      }

      let backgroundImage: string | undefined
      let clearBackgroundImage = false
      if (hasBackgroundImage) {
        if (!backgroundImageRaw) {
          clearBackgroundImage = true
        } else {
          backgroundImage = sanitizeBackgroundImageUrl(backgroundImageRaw)
          if (!backgroundImage) {
            return {
              error: 'Background image must be an http(s), root-relative, or data:image URL.',
            }
          }
        }
      }

      let backgroundMediaId: string | undefined
      let clearBackgroundMediaId = false
      if (hasBackgroundMediaId) {
        if (!backgroundMediaIdRaw) {
          clearBackgroundMediaId = true
        } else {
          backgroundMediaId = sanitizeBackgroundMediaId(backgroundMediaIdRaw)
          if (!backgroundMediaId) {
            return { error: 'Background media id is invalid.' }
          }
          // Prefer resolved library URL when media id is set.
          if (resolvedFromMedia) {
            backgroundImage = resolvedFromMedia
            clearBackgroundImage = false
          }
        }
      }

      let backgroundOverlay: 'enabled' | 'disabled' | undefined
      let clearBackgroundOverlay = false
      if (hasBackgroundOverlay) {
        if (!backgroundOverlayRaw) clearBackgroundOverlay = true
        else backgroundOverlay = backgroundOverlayRaw as 'enabled' | 'disabled'
      }

      let overlayColor: string | undefined
      let clearOverlayColor = false
      if (hasOverlayColor) {
        if (!overlayColorRaw) {
          clearOverlayColor = true
        } else {
          overlayColor = sanitizeCssColorOrGradient(overlayColorRaw, nextAllowOverlay)
          if (!overlayColor) {
            return {
              error: nextAllowOverlay
                ? 'Overlay must be hex, transparent, or a CSS gradient.'
                : 'Overlay color must be a hex value (e.g. #000000) or transparent.',
            }
          }
        }
      }

      const nextStyles = patchSectionStyles(section.styles, {
        ...(hasBackgroundColor
          ? clearBackgroundColor
            ? { clearBackgroundColor: true }
            : { backgroundColor }
          : {}),
        ...(hasTextColor
          ? clearTextColor
            ? { clearTextColor: true }
            : { textColor }
          : {}),
        ...(hasBackgroundMediaId
          ? clearBackgroundMediaId
            ? { clearBackgroundMediaId: true }
            : { backgroundMediaId }
          : {}),
        ...(hasBackgroundImage || resolvedFromMedia
          ? clearBackgroundImage && !resolvedFromMedia
            ? { clearBackgroundImage: true }
            : backgroundImage
              ? { backgroundImage }
              : {}
          : {}),
        ...(hasBackgroundOverlay
          ? clearBackgroundOverlay
            ? { clearBackgroundOverlay: true }
            : { backgroundOverlay }
          : {}),
        ...(hasOverlayColor
          ? clearOverlayColor
            ? { clearOverlayColor: true }
            : { overlayColor }
          : {}),
        ...(hasAllowGradientBackground
          ? allowGradientBackground
            ? { allowGradientBackground: true }
            : { clearAllowGradientBackground: true }
          : {}),
        ...(hasAllowGradientOverlay
          ? allowGradientOverlay
            ? { allowGradientOverlay: true }
            : { clearAllowGradientOverlay: true }
          : {}),
      })
      if (nextStyles) section.styles = nextStyles
      else delete section.styles
    }
    return doc
  })

  if (state.ok) {
    const bits: string[] = []
    if (hasLabel && label) bits.push(`name “${label}”`)
    if (hasCssClass) bits.push(cssClass ? `classes “${cssClass}”` : 'classes cleared')
    if (hasContainerMode && containerMode) bits.push(`container ${containerMode}`)
    if (hasWidth && width != null) bits.push(`column ${width}%`)
    if (hasBackgroundColor) {
      bits.push(backgroundColorRaw ? 'background updated' : 'background cleared')
    }
    if (hasTextColor) {
      bits.push(textColorRaw ? 'text updated' : 'text color cleared')
    }
    if (hasBackgroundMediaId) {
      bits.push(backgroundMediaIdRaw ? 'background media set' : 'background media cleared')
    }
    if (hasBackgroundImage) {
      bits.push(backgroundImageRaw ? 'background image set' : 'background image cleared')
    }
    if (hasBackgroundOverlay && backgroundOverlayRaw) {
      bits.push(`overlay ${backgroundOverlayRaw}`)
    }
    if (hasOverlayColor) {
      bits.push(overlayColorRaw ? 'overlay color updated' : 'overlay color cleared')
    }
    if (hasAllowGradientBackground) {
      bits.push(allowGradientBackground ? 'gradient backgrounds on' : 'gradient backgrounds off')
    }
    if (hasAllowGradientOverlay) {
      bits.push(allowGradientOverlay ? 'gradient overlays on' : 'gradient overlays off')
    }
    state.message = `Section ${bits.join(' · ')} saved.`
  }
  return state
}

/**
 * Set section structure inherit mode relative to outline `inheritFrom`.
 * `inherit` writes a thin stub (parent rows at merge). `local` without prior rows
 * auto-copies the parent section when available.
 */
export async function setSectionInheritModeAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const mode = asInheritModeForm(formData.get('inheritMode'))
  if (!sectionId) return { error: 'Missing section id.' }
  if (!mode) return { error: 'Inherit mode must be inherit or local.' }

  const layoutId = layoutIdFromForm(formData)
  const { document } = await loadLayoutDocument(layoutId)
  if (!document.inheritFrom) {
    return { error: 'This outline has no parent to inherit from.' }
  }
  const parent = await loadParentResolved(document, layoutId)
  const parentSection = parent?.sections.find((s) => s.id === sectionId)

  const state = await mutateLayout(formData, (doc) => {
    const omit = new Set(doc.omitSectionIds ?? [])
    omit.delete(sectionId)
    if (omit.size > 0) doc.omitSectionIds = [...omit]
    else delete doc.omitSectionIds

    const existing = findSection(doc, sectionId)
    if (mode === 'inherit') {
      const stub: LayoutSection = {
        id: sectionId,
        label: existing?.label || parentSection?.label || sectionId,
        inheritMode: 'inherit',
        stylesInheritMode: existing?.stylesInheritMode ?? 'inherit',
        order: existing?.order ?? parentSection?.order ?? doc.sections.length,
        rows: [],
        ...(existing?.cssClass ? { cssClass: existing.cssClass } : {}),
        ...(existing?.containerMode ? { containerMode: existing.containerMode } : {}),
        ...(existing?.width != null ? { width: existing.width } : {}),
        ...(existing?.stylesInheritMode === 'local' && existing.styles
          ? { styles: existing.styles }
          : {}),
      }
      if (existing) {
        Object.assign(existing, stub)
        existing.rows = []
      } else {
        doc.sections.push(stub)
      }
      return doc
    }

    // local
    if (existing && existing.inheritMode !== 'inherit' && (existing.rows?.length ?? 0) > 0) {
      existing.inheritMode = 'local'
      return doc
    }
    if (!parentSection) {
      return { error: `Parent outline has no section “${sectionId}” to copy.` }
    }
    const copied = copySectionFromParent(parentSection)
    copied.order = existing?.order ?? parentSection.order ?? doc.sections.length
    if (existing?.label) copied.label = existing.label
    if (existing) {
      const idx = doc.sections.findIndex((s) => s.id === sectionId)
      if (idx >= 0) doc.sections[idx] = copied
    } else {
      doc.sections.push(copied)
    }
    return doc
  })

  if (state.ok) {
    state.message =
      mode === 'inherit'
        ? `Section “${sectionId}” inherits from parent.`
        : `Section “${sectionId}” is local.`
  }
  return state
}

/**
 * Snapshot parent section into this outline as a local (non-inheriting) copy.
 */
export async function copySectionFromParentAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  if (!sectionId) return { error: 'Missing section id.' }

  const layoutId = layoutIdFromForm(formData)
  const { document } = await loadLayoutDocument(layoutId)
  if (!document.inheritFrom) {
    return { error: 'This outline has no parent to copy from.' }
  }
  const parent = await loadParentResolved(document, layoutId)
  const parentSection = parent?.sections.find((s) => s.id === sectionId)
  if (!parentSection) {
    return { error: `Parent outline has no section “${sectionId}”.` }
  }

  const state = await mutateLayout(formData, (doc) => {
    const omit = new Set(doc.omitSectionIds ?? [])
    omit.delete(sectionId)
    if (omit.size > 0) doc.omitSectionIds = [...omit]
    else delete doc.omitSectionIds
    const existing = findSection(doc, sectionId)
    const copied = copySectionFromParent(parentSection)
    copied.order = existing?.order ?? parentSection.order ?? doc.sections.length
    if (existing?.label) copied.label = existing.label
    if (existing) {
      const idx = doc.sections.findIndex((s) => s.id === sectionId)
      if (idx >= 0) doc.sections[idx] = copied
    } else {
      doc.sections.push(copied)
    }
    return doc
  })

  if (state.ok) state.message = `Section “${sectionId}” copied from parent (local).`
  return state
}

/**
 * Styles card inherit vs local (Layouts → Styles). Whole section.styles bag.
 */
export async function setSectionStylesInheritModeAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const mode = asInheritModeForm(formData.get('stylesInheritMode'))
  if (!sectionId) return { error: 'Missing section id.' }
  if (!mode) return { error: 'Styles inherit mode must be inherit or local.' }

  const layoutId = layoutIdFromForm(formData)
  const { document } = await loadLayoutDocument(layoutId)
  if (!document.inheritFrom) {
    return { error: 'This outline has no parent to inherit styles from.' }
  }
  const parent = await loadParentResolved(document, layoutId)
  const parentSection = parent?.sections.find((s) => s.id === sectionId)

  const state = await mutateLayout(formData, (doc) => {
    let section = findSection(doc, sectionId)
    if (!section) {
      // Materialize thin stub so styles mode can be stored.
      section = {
        id: sectionId,
        label: parentSection?.label || sectionId,
        inheritMode: 'inherit',
        order: parentSection?.order ?? doc.sections.length,
        rows: [],
      }
      doc.sections.push(section)
    }
    section.stylesInheritMode = mode
    if (mode === 'local') {
      if (!section.styles && parentSection?.styles) {
        section.styles = structuredClone(parentSection.styles)
      }
    } else {
      // Inherit styles: drop local bag unless structure is fully local and user
      // still wants parent paint — clearing keeps merge on parent.
      delete section.styles
    }
    return doc
  })

  if (state.ok) {
    state.message =
      mode === 'inherit'
        ? `“${sectionId}” styles inherit from parent.`
        : `“${sectionId}” styles are local.`
  }
  return state
}

/**
 * Snapshot parent section styles into this outline as local (Layouts → Styles Copy).
 */
export async function copySectionStylesFromParentAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  if (!sectionId) return { error: 'Missing section id.' }

  const layoutId = layoutIdFromForm(formData)
  const { document } = await loadLayoutDocument(layoutId)
  if (!document.inheritFrom) {
    return { error: 'This outline has no parent (Base) to copy styles from.' }
  }
  const parent = await loadParentResolved(document, layoutId)
  const parentSection = parent?.sections.find((s) => s.id === sectionId)
  if (!parentSection) {
    return { error: `Parent outline has no section “${sectionId}”.` }
  }

  const state = await mutateLayout(formData, (doc) => {
    let section = findSection(doc, sectionId)
    if (!section) {
      section = {
        id: sectionId,
        label: parentSection.label || sectionId,
        inheritMode: 'inherit',
        order: parentSection.order ?? doc.sections.length,
        rows: [],
      }
      doc.sections.push(section)
    }
    section.stylesInheritMode = 'local'
    section.styles = parentSection.styles
      ? structuredClone(parentSection.styles)
      : undefined
    if (!section.styles) delete section.styles
    return doc
  })

  if (state.ok) {
    state.message = `“${sectionId}” styles copied from Base (local).`
  }
  return state
}

/**
 * Particle inherit vs local against parent outline slot (same id).
 */
export async function setSlotInheritModeAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const slotId = String(formData.get('slotId') ?? '').trim()
  const mode = asInheritModeForm(formData.get('inheritMode'))
  if (!sectionId || !rowId || !slotId) return { error: 'Missing slot path.' }
  if (!mode) return { error: 'Inherit mode must be inherit or local.' }

  const layoutId = layoutIdFromForm(formData)
  const { document } = await loadLayoutDocument(layoutId)
  if (!document.inheritFrom) {
    return { error: 'This outline has no parent to inherit particles from.' }
  }
  const parent = await loadParentResolved(document, layoutId)
  const parentSection = parent?.sections.find((s) => s.id === sectionId)
  const parentSlot = findSlotInSection(parentSection, slotId)

  const state = await mutateLayout(formData, (doc) => {
    const section = findSection(doc, sectionId)
    if (!section) return { error: `Section “${sectionId}” not found (must be local to edit particles).` }
    if (section.inheritMode === 'inherit') {
      return { error: 'Section is inheriting structure — copy/localize the section first.' }
    }
    const found = findSlot(doc, sectionId, rowId, slotId)
    if (!found) return { error: `Slot “${slotId}” not found.` }
    const { slot } = found

    if (mode === 'inherit') {
      if (!parentSlot) {
        return { error: `Parent has no particle “${slotId}” in section “${sectionId}”.` }
      }
      slot.inheritMode = 'inherit'
      delete slot.inheritFromSlotId
      return doc
    }

    // local — if currently inheriting, snapshot parent first
    if (slot.inheritMode === 'inherit' && parentSlot) {
      const copied = copySlotFromParent(parentSlot, slotId)
      Object.assign(slot, copied)
      return doc
    }
    slot.inheritMode = 'local'
    delete slot.inheritFromSlotId
    return doc
  })

  if (state.ok) {
    state.message =
      mode === 'inherit'
        ? `Particle inherits from parent.`
        : `Particle is local.`
  }
  return state
}

/**
 * Snapshot parent particle into this slot as local.
 */
export async function copySlotFromParentAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const slotId = String(formData.get('slotId') ?? '').trim()
  if (!sectionId || !rowId || !slotId) return { error: 'Missing slot path.' }

  const layoutId = layoutIdFromForm(formData)
  const { document } = await loadLayoutDocument(layoutId)
  if (!document.inheritFrom) {
    return { error: 'This outline has no parent to copy from.' }
  }
  const parent = await loadParentResolved(document, layoutId)
  const parentSlot = findSlotInSection(
    parent?.sections.find((s) => s.id === sectionId),
    slotId,
  )
  if (!parentSlot) {
    return { error: `Parent has no particle “${slotId}” in section “${sectionId}”.` }
  }

  const state = await mutateLayout(formData, (doc) => {
    const section = findSection(doc, sectionId)
    if (!section) return { error: `Section “${sectionId}” not found.` }
    if (section.inheritMode === 'inherit') {
      return { error: 'Section is inheriting structure — copy/localize the section first.' }
    }
    const found = findSlot(doc, sectionId, rowId, slotId)
    if (!found) return { error: `Slot “${slotId}” not found.` }
    const copied = copySlotFromParent(parentSlot, slotId)
    Object.assign(found.slot, copied)
    return doc
  })

  if (state.ok) state.message = `Particle copied from parent (local).`
  return state
}

/**
 * Persist outline-scoped breakpoint map (Layouts → Breakpoints child panel).
 * Values are CSS lengths (rem preferred). Empty fields fall back to Helium defaults.
 */
export async function updateLayoutBreakpointsAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const denied = await requireLayoutAdmin()
  if (denied) return denied

  const layoutId = layoutIdFromForm(formData)
  const raw: Partial<LayoutBreakpoints> = {
    largeDesktop: String(formData.get('largeDesktop') ?? '').trim() || undefined,
    desktop: String(formData.get('desktop') ?? '').trim() || undefined,
    tablet: String(formData.get('tablet') ?? '').trim() || undefined,
    mobile: String(formData.get('mobile') ?? '').trim() || undefined,
    mobileMenu: String(formData.get('mobileMenu') ?? '').trim() || undefined,
  }

  const breakpoints = normalizeLayoutBreakpoints({
    ...DEFAULT_LAYOUT_BREAKPOINTS,
    ...raw,
  })

  const state = await mutateLayout(formData, (doc) => {
    doc.styles = { ...(doc.styles ?? {}), breakpoints }
    return doc
  })

  if (state.ok) {
    state.message = `Breakpoints saved for outline “${layoutId}”.`
  }
  return state
}

/**
 * Persist a particle/module instance display name on a layout slot.
 * Does not change `moduleId` (particle type). Empty name clears the override.
 */
export async function renameLayoutSlotAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const slotId = String(formData.get('slotId') ?? '').trim()
  if (!sectionId || !rowId || !slotId) return { error: 'Missing slot reference.' }

  const name = sanitizeDisplayName(String(formData.get('name') ?? ''))

  const state = await mutateLayout(formData, (doc) => {
    const found = findSlot(doc, sectionId, rowId, slotId)
    if (!found) return { error: 'Slot not found.' }
    if (name) found.slot.name = name
    else delete found.slot.name
    return doc
  })

  if (state.ok) {
    state.message = name
      ? `Particle renamed to “${name}”.`
      : 'Particle display name cleared (uses catalog name).'
  }
  return state
}

/**
 * Persist section order after drag-and-drop reorder on the layout canvas.
 * `orderJson` = JSON array of section ids top→bottom.
 * Optional `widthsJson` = `{ [sectionId]: percent }` when placing beside (50|50).
 */
export async function reorderLayoutSectionsAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const raw = String(formData.get('orderJson') ?? '').trim()
  let orderedIds: string[]
  try {
    orderedIds = JSON.parse(raw) as string[]
    if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== 'string')) {
      throw new Error('not string array')
    }
  } catch {
    return { error: 'Invalid section order payload.' }
  }
  if (orderedIds.length === 0) return { error: 'Section order is empty.' }

  const widthsRaw = String(formData.get('widthsJson') ?? '').trim()
  let widthById: Record<string, number> | null = null
  if (widthsRaw) {
    try {
      const parsed = JSON.parse(widthsRaw) as Record<string, unknown>
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('not object')
      }
      widthById = {}
      for (const [id, value] of Object.entries(parsed)) {
        widthById[id] = clampGridWidth(value, LAYOUT_WIDTH_FULL)
      }
    } catch {
      return { error: 'Invalid section widths payload.' }
    }
  }

  const state = await mutateLayout(formData, (doc) => {
    const byId = new Map(doc.sections.map((s) => [s.id, s]))
    if (orderedIds.length !== doc.sections.length) {
      return { error: 'Section order length does not match the layout.' }
    }
    for (const id of orderedIds) {
      if (!byId.has(id)) return { error: `Unknown section “${id}”.` }
    }
    doc.sections = orderedIds.map((id, index) => {
      const section = byId.get(id)!
      section.order = index
      if (widthById && Object.prototype.hasOwnProperty.call(widthById, id)) {
        section.width = widthById[id]!
      }
      return section
    })
    return doc
  })

  if (state.ok) {
    state.message = widthById ? 'Section layout saved.' : 'Section order saved.'
  }
  return state
}

/**
 * Persist row order within one section after drag-and-drop reorder.
 * `orderJson` = JSON array of row ids top→bottom (vertical particle stack order).
 */
export async function reorderLayoutRowsAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const raw = String(formData.get('orderJson') ?? '').trim()
  if (!sectionId) return { error: 'Missing section id.' }

  let orderedIds: string[]
  try {
    orderedIds = JSON.parse(raw) as string[]
    if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== 'string')) {
      throw new Error('not string array')
    }
  } catch {
    return { error: 'Invalid row order payload.' }
  }
  if (orderedIds.length === 0) return { error: 'Row order is empty.' }

  const state = await mutateLayout(formData, (doc) => {
    const section = findSection(doc, sectionId)
    if (!section) return { error: `Section “${sectionId}” not found.` }

    const byId = new Map(section.rows.map((r) => [r.id, r]))
    if (orderedIds.length !== section.rows.length) {
      return { error: 'Row order length does not match the section.' }
    }
    for (const id of orderedIds) {
      if (!byId.has(id)) return { error: `Unknown row “${id}”.` }
    }

    section.rows = orderedIds.map((id, index) => {
      const row = byId.get(id)!
      row.order = index
      return row
    })
    return doc
  })

  if (state.ok) state.message = undefined
  return state
}

/**
 * Persist slot order within one row after drag-and-drop reorder.
 * `orderJson` = JSON array of slot ids left→right. Widths are kept as-is.
 */
export async function reorderRowSlotsAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const raw = String(formData.get('orderJson') ?? '').trim()
  if (!sectionId || !rowId) return { error: 'Missing row reference.' }

  let orderedIds: string[]
  try {
    orderedIds = JSON.parse(raw) as string[]
    if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== 'string')) {
      throw new Error('not string array')
    }
  } catch {
    return { error: 'Invalid slot order payload.' }
  }
  if (orderedIds.length === 0) return { error: 'Slot order is empty.' }

  const state = await mutateLayout(formData, (doc) => {
    const found = findRow(doc, sectionId, rowId)
    if (!found) return { error: 'Row not found.' }

    const byId = new Map(found.row.slots.map((s) => [s.id, s]))
    if (orderedIds.length !== found.row.slots.length) {
      return { error: 'Slot order length does not match the row.' }
    }
    for (const id of orderedIds) {
      if (!byId.has(id)) return { error: `Unknown slot “${id}”.` }
    }

    found.row.slots = orderedIds.map((id, index) => {
      const slot = byId.get(id)!
      slot.order = index
      return slot
    })
    return doc
  })

  if (state.ok) state.message = undefined
  return state
}

/**
 * Move an existing particle from any section/row into another row (or reorder
 * inside the same row). Keeps slot id, config, name, access tags, enabled.
 * Source and destination rows rebalance % widths after the move.
 */
export async function moveSlotToRowAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sourceSectionId = String(formData.get('sourceSectionId') ?? '').trim()
  const sourceRowId = String(formData.get('sourceRowId') ?? '').trim()
  const slotId = String(formData.get('slotId') ?? '').trim()
  const targetSectionId = String(formData.get('targetSectionId') ?? '').trim()
  const targetRowId = String(formData.get('targetRowId') ?? '').trim()
  const indexRaw = formData.get('index')
  const index =
    indexRaw != null && String(indexRaw) !== '' && Number.isFinite(Number(indexRaw))
      ? Math.max(0, Math.floor(Number(indexRaw)))
      : undefined

  if (!sourceSectionId || !sourceRowId || !slotId) {
    return { error: 'Missing source particle reference.' }
  }
  if (!targetSectionId || !targetRowId) {
    return { error: 'Drop onto a row inside a section.' }
  }

  const sameRow = sourceSectionId === targetSectionId && sourceRowId === targetRowId

  const state = await mutateLayout(formData, (doc) => {
    const source = findSlot(doc, sourceSectionId, sourceRowId, slotId)
    if (!source) return { error: 'Source particle not found.' }

    const dest = findRow(doc, targetSectionId, targetRowId)
    if (!dest) return { error: 'Destination row not found.' }

    if (sameRow) {
      const sorted = [...source.row.slots].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id),
      )
      const fromIndex = sorted.findIndex((s) => s.id === slotId)
      if (fromIndex < 0) return { error: 'Source particle not found.' }
      const destIndex =
        index == null ? sorted.length : Math.min(Math.max(0, index), sorted.length)
      if (destIndex === fromIndex || destIndex === fromIndex + 1) {
        return doc
      }
      const next = [...sorted]
      const [moved] = next.splice(fromIndex, 1)
      let insertAt = destIndex
      if (fromIndex < destIndex) insertAt = destIndex - 1
      insertAt = Math.max(0, Math.min(insertAt, next.length))
      next.splice(insertAt, 0, moved)
      source.row.slots = next.map((slot, i) => {
        slot.order = i
        return slot
      })
      return doc
    }

    const moved: LayoutSlot = structuredClone(source.slot)
    source.row.slots = source.row.slots.filter((s) => s.id !== slotId)
    source.row.slots.forEach((s, i) => {
      s.order = i
    })
    if (source.row.slots.length > 0) {
      rebalanceRowSlots(source.row)
    }

    const insertAt =
      index == null ? dest.row.slots.length : Math.min(Math.max(0, index), dest.row.slots.length)
    dest.row.slots.splice(insertAt, 0, moved)
    rebalanceRowSlots(dest.row)
    return doc
  })

  // Silent ok — canvas already moved; avoid noisy “into main” flashes.
  if (state.ok) state.message = undefined
  return state
}

/**
 * Stack a particle into its own full-width row, inserted before/after a target row
 * (vertical blue line — same idea as section mosaic above/below).
 * Solo-row → solo-row in the same section reorders rows instead of cloning.
 */
export async function stackSlotAsRowAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sourceSectionId = String(formData.get('sourceSectionId') ?? '').trim()
  const sourceRowId = String(formData.get('sourceRowId') ?? '').trim()
  const slotId = String(formData.get('slotId') ?? '').trim()
  const targetSectionId = String(formData.get('targetSectionId') ?? '').trim()
  const targetRowId = String(formData.get('targetRowId') ?? '').trim()
  const positionRaw = String(formData.get('position') ?? '').trim()
  const position: 'before' | 'after' = positionRaw === 'after' ? 'after' : 'before'

  if (!sourceSectionId || !sourceRowId || !slotId) {
    return { error: 'Missing source particle reference.' }
  }
  if (!targetSectionId || !targetRowId) {
    return { error: 'Drop onto a row inside a section.' }
  }

  const state = await mutateLayout(formData, (doc) => {
    const source = findSlot(doc, sourceSectionId, sourceRowId, slotId)
    if (!source) return { error: 'Source particle not found.' }

    const targetSection = findSection(doc, targetSectionId)
    if (!targetSection) return { error: 'Destination section not found.' }

    const sortedTarget = [...targetSection.rows].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id),
    )
    const targetIndex = sortedTarget.findIndex((r) => r.id === targetRowId)
    if (targetIndex < 0) return { error: 'Destination row not found.' }

    const sameSection = sourceSectionId === targetSectionId
    const soloSource = source.row.slots.length === 1

    // Solo particle in the same section → reorder its row (no clone).
    if (sameSection && soloSource) {
      const fromIndex = sortedTarget.findIndex((r) => r.id === sourceRowId)
      if (fromIndex < 0) return { error: 'Source row not found.' }
      const destIndex = position === 'before' ? targetIndex : targetIndex + 1
      if (destIndex === fromIndex || destIndex === fromIndex + 1) {
        return doc
      }
      const next = [...sortedTarget]
      const [movedRow] = next.splice(fromIndex, 1)
      let insertAt = destIndex
      if (fromIndex < destIndex) insertAt = destIndex - 1
      insertAt = Math.max(0, Math.min(insertAt, next.length))
      next.splice(insertAt, 0, movedRow!)
      next.forEach((row, i) => {
        row.order = i
      })
      targetSection.rows = next
      ensureSectionEmptyRows(targetSection)
      return doc
    }

    const moved: LayoutSlot = structuredClone(source.slot)
    moved.width = LAYOUT_WIDTH_FULL
    moved.order = 0

    source.row.slots = source.row.slots.filter((s) => s.id !== slotId)
    source.row.slots.forEach((s, i) => {
      s.order = i
    })
    if (source.row.slots.length > 0) {
      rebalanceRowSlots(source.row)
    } else {
      const srcSection = findSection(doc, sourceSectionId)
      if (srcSection) {
        srcSection.rows = srcSection.rows.filter((r) => r.id !== sourceRowId)
        ensureSectionEmptyRows(srcSection)
      }
    }

    // Re-resolve target index after a same-section source-row removal.
    const rowsNow = [...targetSection.rows].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id),
    )
    const targetNow = rowsNow.findIndex((r) => r.id === targetRowId)
    if (targetNow < 0) return { error: 'Destination row not found.' }
    const insertAt = position === 'before' ? targetNow : targetNow + 1
    const newRow: LayoutRow = {
      id: newLayoutEntityId('row'),
      order: insertAt,
      slots: [moved],
    }
    rowsNow.splice(insertAt, 0, newRow)
    rowsNow.forEach((row, i) => {
      row.order = i
    })
    targetSection.rows = rowsNow
    ensureSectionEmptyRows(targetSection)
    return doc
  })

  if (state.ok) state.message = undefined
  return state
}

/** UI + row: open one empty drop row at the end of a section (no-op if already trailing empty). */
export async function addLayoutRowAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  if (!sectionId) return { error: 'Missing section id.' }

  const state = await mutateLayout(formData, (doc) => {
    const section = findSection(doc, sectionId)
    if (!section) return { error: `Section “${sectionId}” not found.` }
    appendEmptyLayoutRow(section)
    return doc
  })

  if (state.ok) state.message = 'Empty row opened.'
  return state
}

/** UI − row: remove an empty drop row only (filled rows keep particles / use slot remove). */
export async function removeLayoutRowAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  if (!sectionId || !rowId) return { error: 'Missing section or row id.' }

  const state = await mutateLayout(formData, (doc) => {
    const section = findSection(doc, sectionId)
    if (!section) return { error: `Section “${sectionId}” not found.` }
    if (!removeEmptyLayoutRow(section, rowId)) {
      return { error: 'Only empty drop rows can be removed with − row.' }
    }
    return doc
  })

  if (state.ok) state.message = 'Empty row closed.'
  return state
}

/**
 * Drag-drop primary path: drop a palette particle into a row.
 * Inserts at `index` (optional) and rebalances widths to sum to 12.
 */
export async function dropParticleIntoRowAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const moduleId = String(formData.get('moduleId') ?? '').trim()
  const indexRaw = formData.get('index')
  const index =
    indexRaw != null && String(indexRaw) !== '' && Number.isFinite(Number(indexRaw))
      ? Math.max(0, Math.floor(Number(indexRaw)))
      : undefined

  if (!sectionId || !rowId) return { error: 'Drop onto a row inside a section.' }
  if (!moduleId) return { error: 'Drag a particle from the left palette.' }

  await ensureModulesRegistered()
  const mod = getRegisteredModule(moduleId)
  if (!mod) return { error: `Particle “${moduleId}” is not registered.` }

  const state = await mutateLayout(formData, (doc) => {
    const found = findRow(doc, sectionId, rowId)
    if (!found) return { error: 'Row not found — add a row in the section first.' }

    const insertAt =
      index == null ? found.row.slots.length : Math.min(index, found.row.slots.length)
    const slot = makeSlot(moduleId, LAYOUT_WIDTH_FULL, insertAt)
    found.row.slots.splice(insertAt, 0, slot)
    rebalanceRowSlots(found.row)
    return doc
  })

  if (state.ok) state.message = `Dropped “${mod.name}” into the row.`
  return state
}

/** @deprecated Prefer dropParticleIntoRowAction — kept for transitional imports. */
export async function addParticleToSectionAction(
  prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  return dropParticleIntoRowAction(prev, formData)
}

/** Persist a single slot width (manual / accessibility). */
export async function setSlotWidthAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const slotId = String(formData.get('slotId') ?? '').trim()
  const width = clampGridWidth(formData.get('width'))
  if (!sectionId || !rowId || !slotId) return { error: 'Missing slot reference.' }

  const state = await mutateLayout(formData, (doc) => {
    const found = findSlot(doc, sectionId, rowId, slotId)
    if (!found) return { error: 'Slot not found.' }
    found.slot.width = width
    return doc
  })

  if (state.ok) state.message = `Width set to ${width}%.`
  return state
}

/**
 * Drag the divider between two adjacent particles: resize by % (stored as 1–12).
 * form: leftSlotId, rightSlotId, leftWidth
 */
export async function resizeAdjacentSlotsAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const leftSlotId = String(formData.get('leftSlotId') ?? '').trim()
  const rightSlotId = String(formData.get('rightSlotId') ?? '').trim()
  const leftWidthRaw = Number(formData.get('leftWidth'))
  if (!sectionId || !rowId || !leftSlotId || !rightSlotId) {
    return { error: 'Missing resize pair.' }
  }

  const state = await mutateLayout(formData, (doc) => {
    const found = findRow(doc, sectionId, rowId)
    if (!found) return { error: 'Row not found.' }
    const left = found.row.slots.find((s) => s.id === leftSlotId)
    const right = found.row.slots.find((s) => s.id === rightSlotId)
    if (!left || !right) return { error: 'Adjacent slots not found.' }
    const [lw, rw] = resizeAdjacentPair(left.width, right.width, leftWidthRaw)
    left.width = lw
    right.width = rw
    return doc
  })

  if (state.ok) state.message = 'Widths updated.'
  return state
}

/** Set every slot width in a row (after a full redistribute). */
export async function setRowSlotWidthsAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const raw = String(formData.get('widthsJson') ?? '')
  if (!sectionId || !rowId) return { error: 'Missing row reference.' }

  let widths: Array<{ slotId: string; width: number }>
  try {
    widths = JSON.parse(raw) as Array<{ slotId: string; width: number }>
    if (!Array.isArray(widths)) throw new Error('not array')
  } catch {
    return { error: 'Invalid widths payload.' }
  }

  const state = await mutateLayout(formData, (doc) => {
    const found = findRow(doc, sectionId, rowId)
    if (!found) return { error: 'Row not found.' }
    for (const entry of widths) {
      const slot = found.row.slots.find((s) => s.id === entry.slotId)
      if (slot) slot.width = clampGridWidth(entry.width)
    }
    return doc
  })

  if (state.ok) state.message = 'Row widths saved.'
  return state
}

export async function removeSlotAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const slotId = String(formData.get('slotId') ?? '').trim()
  if (!sectionId || !rowId || !slotId) return { error: 'Missing slot reference.' }

  const state = await mutateLayout(formData, (doc) => {
    const found = findRow(doc, sectionId, rowId)
    if (!found) return { error: 'Row not found.' }
    const next = found.row.slots.filter((s) => s.id !== slotId)
    if (next.length === found.row.slots.length) return { error: 'Slot not found.' }
    found.row.slots = next
    rebalanceRowSlots(found.row)
    return doc
  })

  if (state.ok) state.message = 'Particle removed.'
  return state
}

export async function toggleSlotAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const slotId = String(formData.get('slotId') ?? '').trim()
  if (!sectionId || !rowId || !slotId) return { error: 'Missing slot reference.' }

  const state = await mutateLayout(formData, (doc) => {
    const found = findSlot(doc, sectionId, rowId, slotId)
    if (!found) return { error: 'Slot not found.' }
    found.slot.enabled = found.slot.enabled === false
    return doc
  })

  if (state.ok) state.message = 'Particle toggled.'
  return state
}

/** Persist multi-tag view access on a layout slot (Nav-consistent; SF-45). */
export async function setSlotAccessTagsAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const slotId = String(formData.get('slotId') ?? '').trim()
  if (!sectionId || !rowId || !slotId) return { error: 'Missing slot reference.' }

  let rawTags: unknown = formData.get('accessTags')
  const asString = rawTags == null ? '' : String(rawTags).trim()
  if (asString.startsWith('[')) {
    try {
      rawTags = JSON.parse(asString) as unknown
    } catch {
      rawTags = asString
    }
  }
  const accessTags = accessTagsForStorage({ accessTags: rawTags })
  const label = (accessTags ?? normalizeAccessTags({})).join(', ')

  const state = await mutateLayout(formData, (doc) => {
    const found = findSlot(doc, sectionId, rowId, slotId)
    if (!found) return { error: 'Slot not found.' }
    if (accessTags) found.slot.accessTags = accessTags
    else delete found.slot.accessTags
    delete found.slot.accessLevel
    return doc
  })

  if (state.ok) {
    state.message = `Particle access set to ${label}.`
  }
  return state
}

/** @deprecated Prefer `setSlotAccessTagsAction` (multi-tag). */
export async function setSlotAccessLevelAction(
  prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const kind = String(formData.get('accessKind') ?? 'public').trim() || 'public'
  const groupId = String(formData.get('accessGroupId') ?? '').trim()
  const tags: string[] =
    kind === 'registered'
      ? ['registered']
      : kind === 'group' && groupId
        ? [`group:${groupId}`]
        : ['public']
  formData.set('accessTags', JSON.stringify(tags))
  return setSlotAccessTagsAction(prev, formData)
}

/**
 * Generic particle slot config save (M1).
 * Editors post `configJson`; Core validates via the module's generated Zod schema.
 */
export async function updateSlotConfigAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const slotId = String(formData.get('slotId') ?? '').trim()
  if (!sectionId || !rowId || !slotId) return { error: 'Missing slot reference.' }

  const layoutId = layoutIdFromForm(formData)
  const { document } = await loadLayoutDocument(layoutId)
  const working =
    document.sections.length > 0 ? structuredClone(document) : cloneDefaultLayoutDocument()
  const found = findSlot(working, sectionId, rowId, slotId)
  if (!found) return { error: 'Slot not found.' }

  const moduleId = found.slot.moduleId
  const { loadParticleConfigSchema } = await import('@/core/modules/particle-config')
  const schema = await loadParticleConfigSchema(moduleId)
  if (!schema) {
    return { error: `No config schema registered for particle “${moduleId}”.` }
  }

  const configJson = String(formData.get('configJson') ?? '').trim()
  if (!configJson) return { error: 'Missing config JSON.' }

  let raw: unknown
  try {
    raw = JSON.parse(configJson)
  } catch {
    return { error: 'Invalid config JSON.' }
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return {
      error: first?.message || `Invalid ${moduleId} particle config.`,
    }
  }

  const config = parsed.data as LayoutSlotConfig

  const state = await mutateLayout(formData, (doc) => {
    const slotFound = findSlot(doc, sectionId, rowId, slotId)
    if (!slotFound) return { error: 'Slot not found.' }
    if (slotFound.slot.moduleId !== moduleId) {
      return { error: `Particle type mismatch for “${moduleId}”.` }
    }
    slotFound.slot.config = config
    return doc
  })

  if (state.ok) {
    state.message = `${getRegisteredModule(moduleId)?.name ?? moduleId} saved.`
    state.config = config
  }
  return state
}

/** Optional HTML id + CSS classes on any particle (public column wrapper). */
export async function updateSlotAttributesAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const slotId = String(formData.get('slotId') ?? '').trim()
  if (!sectionId || !rowId || !slotId) return { error: 'Missing slot reference.' }

  const htmlIdRaw = String(formData.get('htmlId') ?? '').trim()
  let htmlId: string | undefined
  if (htmlIdRaw) {
    htmlId = sanitizeHtmlId(htmlIdRaw)
    if (!htmlId) {
      return {
        error:
          'HTML id must start with a letter or underscore and use only letters, digits, _, :, ., or -.',
      }
    }
  }

  const cssClassRaw = String(formData.get('cssClass') ?? '')
  const cssClassTyped = cssClassRaw.trim()
  const cssClass = sanitizeCssClassList(cssClassRaw)
  if (cssClassTyped && !cssClass) {
    return {
      error:
        'CSS class tokens must start with a letter or underscore (letters, digits, _, - only).',
    }
  }

  const state = await mutateLayout(formData, (doc) => {
    const found = findSlot(doc, sectionId, rowId, slotId)
    if (!found) return { error: 'Slot not found.' }
    if (htmlId) found.slot.htmlId = htmlId
    else delete found.slot.htmlId
    if (cssClass) found.slot.cssClass = cssClass
    else delete found.slot.cssClass
    return doc
  })

  if (state.ok) {
    state.message = 'Particle attributes saved.'
    state.slotAttrs = {
      ...(htmlId ? { htmlId } : {}),
      ...(cssClass ? { cssClass } : {}),
    }
  }
  return state
}

export async function resetLayoutToDefaultAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const denied = await requireLayoutAdmin()
  if (denied) return denied

  const layoutId = layoutIdFromForm(formData)

  try {
    await saveLayoutDocument(cloneDefaultLayoutDocument(), layoutId)
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Could not reset the layout document.'
    return { error: message }
  }

  revalidateLayoutPaths(layoutId)
  return {
    ok: true,
    message: 'Layout reset to default (notice-bar, site-header, page-content, custom footer).',
  }
}

export async function listModulesForLayoutAdmin() {
  await ensureModulesRegistered()
  const {
    MODULE_IDS,
    getSiteSettings,
    isCatalogModuleEnabled,
    isParticleModuleEnabled,
  } = await import('@/core/settings')
  const settings = await getSiteSettings()
  const formsProductOn = isCatalogModuleEnabled(settings, MODULE_IDS.forms)
  const searchProductOn = isCatalogModuleEnabled(settings, MODULE_IDS.search)

  return listRegisteredModules()
    .filter((m) => {
      if (m.id === 'form' && !formsProductOn) return false
      if (m.id === 'search' && !searchProductOn) return false
      return isParticleModuleEnabled(settings, m.id, {
        builtin: m.builtin,
        featureFlag: m.featureFlag,
      })
    })
    .map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description ?? '',
      builtin: Boolean(m.builtin),
      defaultWidth: m.defaultWidth ?? 100,
    }))
}

// Note: dynamic import avoids a circular init edge (settings catalog ↔ modules).
