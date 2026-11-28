'use server'

import { requireAdminArea } from '@/core/acl/access'
import { userIsDeveloperAdmin } from '@/core/auth/admin'

import {
  cloneWorkingLayoutDocument,
  findSlot,
  sanitizeCssClassList,
  sanitizeHtmlId,
} from './document'
import {
  layoutIdFromForm,
  mutateLayout,
  type LayoutActionState,
} from './layout-mutate'
import { loadLayoutDocument } from './layout-store'
import { getRegisteredModule } from './registry'
import type { LayoutSlotConfig } from './types'

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
  const working = cloneWorkingLayoutDocument(document)
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

  const { syncLayoutSlotLocalesToFiles } = await import('@/core/i18n/content-locales/sync')
  const syncedConfig = (await syncLayoutSlotLocalesToFiles({
    layoutId,
    slotId,
    config: { ...(parsed.data as Record<string, unknown>) },
  })) as LayoutSlotConfig

  const state = await mutateLayout(formData, (doc) => {
    const slotFound = findSlot(doc, sectionId, rowId, slotId)
    if (!slotFound) return { error: 'Slot not found.' }
    if (slotFound.slot.moduleId !== moduleId) {
      return { error: `Particle type mismatch for “${moduleId}”.` }
    }
    slotFound.slot.config = syncedConfig
    return doc
  })

  if (state.ok) {
    state.message = `${getRegisteredModule(moduleId)?.name ?? moduleId} saved.`
    // Persist stripped maps to disk/DB; return client config with maps so LocaleInput stays hydrated.
    state.config = parsed.data as LayoutSlotConfig
  }
  return state
}

/** Optional HTML id + CSS classes + particle CSS/JS on any particle wrapper. */
export async function updateSlotAttributesAction(
  _prev: LayoutActionState,
  formData: FormData,
): Promise<LayoutActionState> {
  const sectionId = String(formData.get('sectionId') ?? '').trim()
  const rowId = String(formData.get('rowId') ?? '').trim()
  const slotId = String(formData.get('slotId') ?? '').trim()
  if (!sectionId || !rowId || !slotId) return { error: 'Missing slot reference.' }

  const session = await requireAdminArea('admin.layouts', 'edit')
  const isDev = userIsDeveloperAdmin(session?.user)

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

  const particleCssRaw = String(formData.get('particleCss') ?? '')
  const particleCss = particleCssRaw.trim() ? particleCssRaw : undefined
  const particleJsRaw = String(formData.get('particleJs') ?? '')
  const particleJs = particleJsRaw.trim() ? particleJsRaw : undefined

  let savedParticleJs: string | undefined
  const state = await mutateLayout(formData, (doc) => {
    const found = findSlot(doc, sectionId, rowId, slotId)
    if (!found) return { error: 'Slot not found.' }
    if (htmlId) found.slot.htmlId = htmlId
    else delete found.slot.htmlId
    if (cssClass) found.slot.cssClass = cssClass
    else delete found.slot.cssClass
    if (particleCss) found.slot.particleCss = particleCss
    else delete found.slot.particleCss
    // JS is developer-admin only — non-dev saves leave prior JS untouched.
    if (isDev) {
      if (particleJs) found.slot.particleJs = particleJs
      else delete found.slot.particleJs
      savedParticleJs = found.slot.particleJs
    } else {
      savedParticleJs = found.slot.particleJs
    }
    return doc
  })

  if (state.ok) {
    state.message = 'Particle attributes saved.'
    state.slotAttrs = {
      ...(htmlId ? { htmlId } : {}),
      ...(cssClass ? { cssClass } : {}),
      ...(particleCss ? { particleCss } : {}),
      ...(savedParticleJs ? { particleJs: savedParticleJs } : {}),
    }
  }
  return state
}

