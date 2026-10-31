/**
 * P0 runtime module toggles (Site Settings → Modules).
 * Installed catalog = registered particles + atoms; disabled → skip palette / public / atoms.
 */

import type { SiteSettingsData } from './defaults'

/** Prefix for Page Settings atom types in the shared toggle map. */
export const ATOM_TOGGLE_PREFIX = 'atom:' as const

/** Core chrome particles that cannot be turned off (layout always needs them). */
export const REQUIRED_MODULE_IDS = new Set(['page-content'])

export type ModuleToggleKind = 'particle' | 'atom'

export type ModuleToggleEntry = {
  id: string
  enabled: boolean
}

/** Row for the Site Settings → Modules admin list. */
export type ModuleCatalogItem = {
  /** Storage / gate key (`notice-bar` or `atom:analytics`). */
  id: string
  kind: ModuleToggleKind
  label: string
  description: string
  /** When true, toggle is locked on (required chrome). */
  required: boolean
  /** Default when no stored row exists. */
  defaultEnabled: boolean
  installed: true
}

export function atomToggleId(type: string): string {
  const t = type.trim()
  if (!t) return `${ATOM_TOGGLE_PREFIX}unknown`
  return t.startsWith(ATOM_TOGGLE_PREFIX) ? t : `${ATOM_TOGGLE_PREFIX}${t}`
}

export function parseAtomToggleId(id: string): string | null {
  if (!id.startsWith(ATOM_TOGGLE_PREFIX)) return null
  const type = id.slice(ATOM_TOGGLE_PREFIX.length).trim()
  return type || null
}

export function normalizeModuleToggles(
  raw: unknown,
): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  if (!Array.isArray(raw)) return out
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const rec = row as { moduleId?: unknown; id?: unknown; enabled?: unknown }
    const id =
      typeof rec.moduleId === 'string'
        ? rec.moduleId.trim()
        : typeof rec.id === 'string'
          ? rec.id.trim()
          : ''
    if (!id) continue
    out[id] = rec.enabled !== false
  }
  return out
}

export function moduleTogglesToPayloadRows(
  map: Record<string, boolean>,
): Array<{ moduleId: string; enabled: boolean }> {
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([moduleId, enabled]) => ({ moduleId, enabled: Boolean(enabled) }))
}

/**
 * Resolve whether a catalog id is enabled for this site.
 * Required modules always on. Missing row → `defaultEnabled` (or master Modules flag
 * for legacy extension modules that used `featureFlag: 'modules'`).
 */
export function isModuleToggleEnabled(
  settings: SiteSettingsData,
  catalogId: string,
  options?: { defaultEnabled?: boolean; legacyModulesFlag?: boolean },
): boolean {
  const id = catalogId.trim()
  if (!id) return false
  if (REQUIRED_MODULE_IDS.has(id)) return true

  const stored = settings.moduleToggles?.[id]
  if (typeof stored === 'boolean') return stored

  if (options?.legacyModulesFlag) {
    return Boolean(settings.features.modules)
  }

  return options?.defaultEnabled !== false
}

/** True when any non-required particle/extension toggle is on (keeps master flag in sync). */
export function anyExtensionModuleEnabled(
  settings: SiteSettingsData,
  catalog: ModuleCatalogItem[],
): boolean {
  return catalog.some((item) => {
    if (item.required || item.kind !== 'particle') return false
    return isModuleToggleEnabled(settings, item.id, {
      defaultEnabled: item.defaultEnabled,
      legacyModulesFlag: item.id === 'notice-bar' || item.defaultEnabled === false,
    })
  })
}
