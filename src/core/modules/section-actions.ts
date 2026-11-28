'use server'

import { resolveMediaById } from '@/core/media/resolve'

import {
  cloneDefaultLayoutDocument,
  findSection,
  newLayoutEntityId,
  sanitizeCssClassList,
  sanitizeHtmlId,
  slugifyLayoutId,
} from './document'
import { clampGridWidth, LAYOUT_WIDTH_FULL } from './grid'
import { copySectionFromParent } from './inherit-merge'
import {
  asInheritModeForm,
  assignSyncedRowContainers,
  formSourceOutlineId,
  layoutIdFromForm,
  loadParentResolved,
  loadResolvedOutline,
  mutateLayout,
  parentOutlineId,
  requireLayoutAdmin,
  revalidateLayoutPaths,
  storeOutlineSource,
  type LayoutActionState,
} from './layout-mutate'
import { loadLayoutDocument, saveLayoutDocument } from './layout-store'
import {
  normalizeLayoutSectionStyles,
  sanitizeBackgroundImageUrl,
  sanitizeBackgroundMediaId,
  sanitizeCssBoxShorthand,
  sanitizeCssColor,
  sanitizeCssColorOrGradient,
  type LayoutContainerMode,
  type LayoutSectionStyles,
} from './styles'
import type { LayoutSection } from './types'

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
    assignSyncedRowContainers(doc)
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
    assignSyncedRowContainers(doc)
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
    clearPadding?: boolean
    clearMargin?: boolean
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
  if (patch.clearPadding) delete next.padding
  else if (patch.padding !== undefined) next.padding = patch.padding
  if (patch.clearMargin) delete next.margin
  else if (patch.margin !== undefined) next.margin = patch.margin
  return normalizeLayoutSectionStyles(next)
}

/**
 * Persist section display name, HTML id, CSS classes, container mode, and/or
 * Section Styles (background, text, image, overlay). Section layout `id` is
 * never changed. Empty htmlId / cssClass / colors / image clear. Styles live on
 * the section — deleting the section removes its Styles entry automatically.
 */
export async function updateLayoutSectionMetaAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  if (!sectionId) return { error: 'Missing section id.' }

  const hasLabel = formData.has('label')
  const hasHtmlId = formData.has('htmlId')
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
  const hasPadding = formData.has('padding')
  const hasMargin = formData.has('margin')
  const stylesTouched =
    hasBackgroundColor ||
    hasTextColor ||
    hasBackgroundImage ||
    hasBackgroundMediaId ||
    hasBackgroundOverlay ||
    hasOverlayColor ||
    hasAllowGradientBackground ||
    hasAllowGradientOverlay ||
    hasPadding ||
    hasMargin
  if (
    !hasLabel &&
    !hasHtmlId &&
    !hasCssClass &&
    !hasContainerMode &&
    !hasWidth &&
    !stylesTouched
  ) {
    return { error: 'Nothing to update on this section.' }
  }

  const label = hasLabel ? String(formData.get('label') ?? '').trim() : undefined
  if (hasLabel && !label) return { error: 'Section name is required.' }

  const htmlIdRaw = hasHtmlId ? String(formData.get('htmlId') ?? '').trim() : undefined
  let htmlId: string | undefined
  if (hasHtmlId) {
    if (htmlIdRaw) {
      htmlId = sanitizeHtmlId(htmlIdRaw)
      if (!htmlId) {
        return {
          error:
            'HTML id is invalid. Use a letter or underscore first, then letters, digits, _, :, ., or -.',
        }
      }
    }
  }

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
  const paddingRaw = hasPadding ? String(formData.get('padding') ?? '').trim() : undefined
  const marginRaw = hasMargin ? String(formData.get('margin') ?? '').trim() : undefined

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
    let section = findSection(doc, sectionId)
    // Inheriting children often omit sections (inherit-by-absence). Materialize a
    // thin stub so containerMode / width / styles overlay the parent on merge.
    if (!section && doc.inheritFrom) {
      section = {
        id: sectionId,
        label: label || sectionId,
        inheritMode: 'inherit',
        stylesInheritMode: 'inherit',
        order: doc.sections.length,
        rows: [],
      }
      doc.sections.push(section)
    }
    if (!section) return { error: `Section “${sectionId}” not found.` }
    if (hasLabel && label) section.label = label
    if (hasHtmlId) {
      if (htmlId) section.htmlId = htmlId
      else delete section.htmlId
    }
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

      let padding: string | undefined
      let clearPadding = false
      if (hasPadding) {
        if (!paddingRaw) {
          clearPadding = true
        } else {
          padding = sanitizeCssBoxShorthand(paddingRaw, { allowNegative: false })
          if (!padding) {
            return {
              error:
                'Padding must be 1–4 lengths with the same px or rem unit (e.g. 1rem 1.5rem 1rem 1.5rem).',
            }
          }
        }
      }

      let margin: string | undefined
      let clearMargin = false
      if (hasMargin) {
        if (!marginRaw) {
          clearMargin = true
        } else {
          margin = sanitizeCssBoxShorthand(marginRaw, { allowNegative: true })
          if (!margin) {
            return {
              error:
                'Margin must be 1–4 lengths with the same px or rem unit (e.g. 0 0 2rem 0).',
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
        ...(hasPadding ? (clearPadding ? { clearPadding: true } : { padding }) : {}),
        ...(hasMargin ? (clearMargin ? { clearMargin: true } : { margin }) : {}),
      })
      if (nextStyles) section.styles = nextStyles
      else delete section.styles
    }
    if (hasWidth) assignSyncedRowContainers(doc)
    return doc
  })

  if (state.ok) {
    const bits: string[] = []
    if (hasLabel && label) bits.push(`name “${label}”`)
    if (hasHtmlId) bits.push(htmlId ? `id “${htmlId}”` : 'id cleared')
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
    if (hasPadding) {
      bits.push(paddingRaw ? 'padding updated' : 'padding cleared')
    }
    if (hasMargin) {
      bits.push(marginRaw ? 'margin updated' : 'margin cleared')
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
  const sourceOnly = String(formData.get('sourceOnly') ?? '') === '1'
  const mode = asInheritModeForm(formData.get('inheritMode'))
  if (!sectionId) return { error: 'Missing section id.' }
  if (!sourceOnly && !mode) return { error: 'Inherit mode must be inherit or local.' }

  const layoutId = layoutIdFromForm(formData)
  const { document } = await loadLayoutDocument(layoutId)
  const parentId = await parentOutlineId(document, layoutId)
  const requestedSource = formSourceOutlineId(formData)
  const sourceId = requestedSource || parentId
  if (!sourceId) {
    return { error: 'This outline has no parent to inherit from.' }
  }
  const source = await loadResolvedOutline(sourceId)
  if (!source) return { error: `Layout “${sourceId}” was not found.` }
  const parentSection = source.sections.find((s) => s.id === sectionId)
  if (!parentSection) {
    return { error: `That layout has no section “${sectionId}”.` }
  }

  const state = await mutateLayout(formData, (doc) => {
    if ((sourceOnly || mode === 'inherit') && !String(doc.inheritFrom ?? '').trim() && parentId) {
      doc.inheritFrom = parentId
    }
    const omit = new Set(doc.omitSectionIds ?? [])
    omit.delete(sectionId)
    if (omit.size > 0) doc.omitSectionIds = [...omit]
    else delete doc.omitSectionIds

    const existing = findSection(doc, sectionId)
    if (sourceOnly) {
      if (!existing) return { error: `Section “${sectionId}” was not found.` }
      storeOutlineSource(existing, sourceId, parentId)
      if (existing.inheritMode === 'inherit') {
        existing.rows = []
        existing.stylesInheritMode = 'inherit'
      }
      return doc
    }
    if (mode === 'inherit') {
      // Thin stub only. Settings and particles stay on the chosen layout and merge at read.
      const stub: LayoutSection = {
        id: sectionId,
        label: existing?.label?.trim() || parentSection?.label || sectionId,
        inheritMode: 'inherit',
        stylesInheritMode: 'inherit',
        order: existing?.order ?? parentSection?.order ?? doc.sections.length,
        rows: [],
      }
      storeOutlineSource(stub, sourceId, parentId)
      if (existing) {
        const idx = doc.sections.findIndex((s) => s.id === sectionId)
        if (idx >= 0) doc.sections[idx] = stub
      } else {
        doc.sections.push(stub)
      }
      return doc
    }

    // local
    if (existing && existing.inheritMode !== 'inherit' && (existing.rows?.length ?? 0) > 0) {
      existing.inheritMode = 'local'
      storeOutlineSource(existing, sourceId, parentId)
      return doc
    }
    if (!parentSection) {
      return { error: `Parent outline has no section “${sectionId}” to copy.` }
    }
    const copied = copySectionFromParent(parentSection)
    copied.order = existing?.order ?? parentSection.order ?? doc.sections.length
    const renamed = existing?.label?.trim()
    if (renamed && renamed !== sectionId) copied.label = renamed
    storeOutlineSource(copied, sourceId, parentId)
    if (existing) {
      const idx = doc.sections.findIndex((s) => s.id === sectionId)
      if (idx >= 0) doc.sections[idx] = copied
    } else {
      doc.sections.push(copied)
    }
    return doc
  })

  if (state.ok) {
    state.message = sourceOnly
      ? `Section “${sectionId}” will inherit from “${sourceId}”.`
      : mode === 'inherit'
        ? `Section “${sectionId}” inherits settings and particles from “${sourceId}”.`
        : `Section “${sectionId}” is a local copy of “${sourceId}”.`
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
  const parentId = await parentOutlineId(document, layoutId)
  const sourceId = formSourceOutlineId(formData) || parentId
  if (!sourceId) return { error: 'This outline has no parent to copy from.' }
  const source = await loadResolvedOutline(sourceId)
  if (!source) return { error: `Layout “${sourceId}” was not found.` }
  const parentSection = source.sections.find((s) => s.id === sectionId)
  if (!parentSection) {
    return { error: `That layout has no section “${sectionId}”.` }
  }

  const state = await mutateLayout(formData, (doc) => {
    const omit = new Set(doc.omitSectionIds ?? [])
    omit.delete(sectionId)
    if (omit.size > 0) doc.omitSectionIds = [...omit]
    else delete doc.omitSectionIds
    const existing = findSection(doc, sectionId)
    const copied = copySectionFromParent(parentSection)
    copied.order = existing?.order ?? parentSection.order ?? doc.sections.length
    const renamed = existing?.label?.trim()
    if (renamed && renamed !== sectionId) copied.label = renamed
    storeOutlineSource(copied, sourceId, parentId)
    if (existing) {
      const idx = doc.sections.findIndex((s) => s.id === sectionId)
      if (idx >= 0) doc.sections[idx] = copied
    } else {
      doc.sections.push(copied)
    }
    return doc
  })

  if (state.ok) state.message = `Section “${sectionId}” copied from parent (settings and particles).`
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
  const parent = await loadParentResolved(document, layoutId)
  if (!parent) return { error: 'This outline has no parent to inherit styles from.' }
  const parentSection = parent.sections.find((s) => s.id === sectionId)

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
  const parent = await loadParentResolved(document, layoutId)
  if (!parent) return { error: 'This outline has no parent (Base) to copy styles from.' }
  const parentSection = parent.sections.find((s) => s.id === sectionId)
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
    assignSyncedRowContainers(doc)
    return doc
  })

  if (state.ok) {
    state.message = widthById ? 'Section layout saved.' : 'Section order saved.'
  }
  return state
}

export async function resetLayoutToDefaultAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const denied = await requireLayoutAdmin('manage')
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
    message:
      'Layout reset to default (notice-bar, site-header, page-content, cookie-settings footer).',
  }
}

