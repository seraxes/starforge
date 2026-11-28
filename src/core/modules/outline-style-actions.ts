'use server'

import {
  layoutIdFromForm,
  loadParentResolved,
  mutateLayout,
  requireLayoutAdmin,
  type LayoutActionState,
} from './layout-mutate'
import { loadLayoutDocument } from './layout-store'
import {
  DEFAULT_LAYOUT_BREAKPOINTS,
  layoutBodyBackgroundFromFit,
  normalizeLayoutBodyBackground,
  normalizeLayoutBreakpoints,
  normalizeLayoutTypography,
  type LayoutBodyBackground,
  type LayoutBodyBackgroundFit,
  type LayoutBreakpoints,
  type LayoutDocumentStyles,
  type LayoutTypography,
} from './styles'
import type { LayoutDocument } from './types'

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

function bodyFitFromForm(raw: unknown): LayoutBodyBackgroundFit {
  const fit = String(raw ?? '').trim()
  if (fit === 'cover-scroll' || fit === 'contain' || fit === 'tile') return fit
  return 'cover-fixed'
}

/**
 * Merge one outline style block. A key set to `null` drops that block.
 * Omitted keys stay (saving page background must not wipe type, and the reverse).
 */
function patchOutlineStyles(
  doc: LayoutDocument,
  patch: {
    body?: LayoutBodyBackground | null
    typography?: LayoutTypography | null
  },
): void {
  const prev = doc.styles
  const breakpoints = prev?.breakpoints
  const body = 'body' in patch ? (patch.body ?? undefined) : prev?.body
  const typography = 'typography' in patch ? (patch.typography ?? undefined) : prev?.typography
  if (!breakpoints && !body && !typography) {
    delete doc.styles
    return
  }
  const next: LayoutDocumentStyles = {
    ...(breakpoints ? { breakpoints } : {}),
    ...(body ? { body } : {}),
    ...(typography ? { typography } : {}),
  }
  doc.styles = next
}

/**
 * Persist the outline page background (Layouts → Styles → Page background).
 * `mode=inherit` drops the local block so the parent background returns.
 * `mode=clear` removes it; `blockInherit=1` stores a local opt-out on child outlines.
 */
export async function updateLayoutBodyBackgroundAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const denied = await requireLayoutAdmin()
  if (denied) return denied

  const mode = String(formData.get('mode') ?? 'set').trim()
  const state = await mutateLayout(formData, (doc) => {
    if (mode === 'inherit') {
      patchOutlineStyles(doc, { body: null })
      return doc
    }
    if (mode === 'clear') {
      patchOutlineStyles(doc, {
        body: formData.get('blockInherit') === '1' ? { disabled: true } : null,
      })
      return doc
    }

    const body = normalizeLayoutBodyBackground({
      backgroundColor: String(formData.get('backgroundColor') ?? ''),
      allowGradientBackground: formData.get('allowGradientBackground') === '1',
      backgroundMediaId: String(formData.get('backgroundMediaId') ?? ''),
      backgroundImage: String(formData.get('backgroundImage') ?? ''),
      ...layoutBodyBackgroundFromFit(bodyFitFromForm(formData.get('fit'))),
      backgroundOverlay: String(formData.get('backgroundOverlay') ?? '').trim() === 'enabled'
        ? 'enabled'
        : 'disabled',
      overlayColor: String(formData.get('overlayColor') ?? ''),
      allowGradientOverlay: formData.get('allowGradientOverlay') === '1',
    })
    if (!body) {
      patchOutlineStyles(doc, {
        body: formData.get('blockInherit') === '1' ? { disabled: true } : null,
      })
      return doc
    }
    patchOutlineStyles(doc, { body })
    return doc
  })

  if (state.ok) state.message = 'Page background saved.'
  return state
}

/** Snapshot the parent outline page background onto this outline as local. */
export async function copyLayoutBodyBackgroundFromParentAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const denied = await requireLayoutAdmin()
  if (denied) return denied

  const layoutId = layoutIdFromForm(formData)
  const { document } = await loadLayoutDocument(layoutId)
  const parent = await loadParentResolved(document, layoutId)
  if (!parent) return { error: 'This outline has no parent to copy from.' }

  const copied = normalizeLayoutBodyBackground(parent.styles?.body)
  const state = await mutateLayout(formData, (doc) => {
    if (!copied || copied.disabled) {
      patchOutlineStyles(doc, { body: { disabled: true } })
      return doc
    }
    const body = { ...copied }
    delete body.disabled
    patchOutlineStyles(doc, { body })
    return doc
  })

  if (state.ok) state.message = 'Page background copied from parent.'
  return state
}

/**
 * Persist outline type (Layouts → Styles → Type & accent).
 * `mode=inherit` drops the local block. `mode=clear` removes it;
 * `blockInherit=1` stores a local opt-out on child outlines.
 */
export async function updateLayoutTypographyAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const denied = await requireLayoutAdmin()
  if (denied) return denied

  const mode = String(formData.get('mode') ?? 'set').trim()
  const state = await mutateLayout(formData, (doc) => {
    if (mode === 'inherit') {
      patchOutlineStyles(doc, { typography: null })
      return doc
    }
    if (mode === 'clear') {
      patchOutlineStyles(doc, {
        typography: formData.get('blockInherit') === '1' ? { disabled: true } : null,
      })
      return doc
    }

    const typography = normalizeLayoutTypography({
      titleFont: String(formData.get('titleFont') ?? ''),
      textFont: String(formData.get('textFont') ?? ''),
      titleColor: String(formData.get('titleColor') ?? ''),
      textColor: String(formData.get('textColor') ?? ''),
      linkColor: String(formData.get('linkColor') ?? ''),
      linkHoverColor: String(formData.get('linkHoverColor') ?? ''),
    })
    if (!typography) {
      patchOutlineStyles(doc, {
        typography: formData.get('blockInherit') === '1' ? { disabled: true } : null,
      })
      return doc
    }
    patchOutlineStyles(doc, { typography })
    return doc
  })

  if (state.ok) state.message = 'Type saved.'
  return state
}

/** Snapshot the parent outline type onto this outline as local. */
export async function copyLayoutTypographyFromParentAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const denied = await requireLayoutAdmin()
  if (denied) return denied

  const layoutId = layoutIdFromForm(formData)
  const { document } = await loadLayoutDocument(layoutId)
  const parent = await loadParentResolved(document, layoutId)
  if (!parent) return { error: 'This outline has no parent to copy from.' }

  const copied = normalizeLayoutTypography(parent.styles?.typography)
  const state = await mutateLayout(formData, (doc) => {
    if (!copied || copied.disabled) {
      patchOutlineStyles(doc, { typography: { disabled: true } })
      return doc
    }
    const typography = { ...copied }
    delete typography.disabled
    patchOutlineStyles(doc, { typography })
    return doc
  })

  if (state.ok) state.message = 'Type copied from parent.'
  return state
}

