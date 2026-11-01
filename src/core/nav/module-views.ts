import { listRegisteredModules } from '@/core/modules/registry'
import type { ModuleNavView } from '@/core/modules/types'
import type { SiteSettingsData } from '@/core/settings/defaults'
import {
  isCatalogModuleEnabled,
  listInstalledModuleCatalog,
} from '@/core/settings/module-catalog'

import type { NavModuleOption, NavModuleViewOption } from './types'

function normalizeViews(raw: ModuleNavView[] | undefined): NavModuleViewOption[] {
  if (!Array.isArray(raw) || raw.length === 0) return []
  const out: NavModuleViewOption[] = []
  for (const view of raw) {
    const key = typeof view?.key === 'string' ? view.key.trim() : ''
    const label = typeof view?.label === 'string' ? view.label.trim() : ''
    const href = typeof view?.href === 'string' ? view.href.trim() : ''
    if (!key || !label || !href) continue
    out.push({ key, label, href })
  }
  return out
}

/**
 * Modules (catalog + particle registry) that are installed, enabled, and declare
 * at least one navigable view — for Nav manager “Module” link type.
 */
export function listEnabledModuleNavOptions(settings: SiteSettingsData): NavModuleOption[] {
  const byId = new Map<string, NavModuleOption>()

  for (const item of listInstalledModuleCatalog()) {
    if (!item.installed) continue
    if (!isCatalogModuleEnabled(settings, item.id)) continue
    const views = normalizeViews(item.navViews as ModuleNavView[] | undefined)
    if (views.length === 0) continue
    byId.set(item.id, {
      moduleId: item.id,
      moduleLabel: item.label,
      views,
    })
  }

  // Particle/extension registry may declare navViews not mirrored on catalog rows.
  for (const mod of listRegisteredModules()) {
    if (!isCatalogModuleEnabled(settings, mod.id)) continue
    const views = normalizeViews(mod.navViews)
    if (views.length === 0) continue
    const existing = byId.get(mod.id)
    if (!existing) {
      byId.set(mod.id, {
        moduleId: mod.id,
        moduleLabel: mod.name,
        views,
      })
      continue
    }
    // Merge unique keys (catalog wins on conflict).
    const keys = new Set(existing.views.map((v) => v.key))
    for (const view of views) {
      if (!keys.has(view.key)) existing.views.push(view)
    }
  }

  return [...byId.values()].sort((a, b) => a.moduleLabel.localeCompare(b.moduleLabel))
}

/** Resolve href for a module + view key against the current enabled catalog. */
export function resolveModuleNavHref(
  settings: SiteSettingsData,
  moduleId: string | null | undefined,
  viewKey: string | null | undefined,
): string | null {
  const id = typeof moduleId === 'string' ? moduleId.trim() : ''
  const key = typeof viewKey === 'string' ? viewKey.trim() : ''
  if (!id || !key) return null
  if (!isCatalogModuleEnabled(settings, id)) return null

  const options = listEnabledModuleNavOptions(settings)
  const mod = options.find((m) => m.moduleId === id)
  const view = mod?.views.find((v) => v.key === key)
  return view?.href?.trim() || null
}
