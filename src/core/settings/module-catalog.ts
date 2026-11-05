import {
  ALLOWLISTED_ATOM_META,
  ALLOWLISTED_PARTICLE_META,
  ALLOWLISTED_PRODUCT_PLATFORM_META,
  isModuleAllowlisted,
} from '@/generated/module-registry'

import type { FeatureFlags, ModuleToggleMap, SiteSettingsData } from './defaults'
import {
  MODULE_KIND_ORDER,
  REQUIRED_MODULE_IDS,
  isModuleToggleEnabled,
  type ModuleCatalogItem,
} from './module-toggles'

/**
 * @deprecated Hand-maintained duplicate removed in SF-141.
 * Prefer `ALLOWLISTED_PRODUCT_PLATFORM_META` from `@/generated/module-registry`
 * (derived from `defineStarforgeModule` manifests).
 */
export const PRODUCT_MODULE_CATALOG: ModuleCatalogItem[] = ALLOWLISTED_PRODUCT_PLATFORM_META

/**
 * Installed catalog for Settings → Modules.
 * Fully derived from generated module-registry metadata (one catalog).
 * Only allowlisted (install/build) modules appear — runtime toggles apply on top.
 */
export function listInstalledModuleCatalog(): ModuleCatalogItem[] {
  const products = ALLOWLISTED_PRODUCT_PLATFORM_META.filter(
    (item) => item.required || isModuleAllowlisted(item.id),
  )

  const particles: ModuleCatalogItem[] = ALLOWLISTED_PARTICLE_META.filter((meta) =>
    isModuleAllowlisted(meta.id),
  ).map((meta) => ({
    id: meta.id,
    kind: 'particle' as const,
    label: meta.name,
    description: meta.description,
    required: meta.required || REQUIRED_MODULE_IDS.has(meta.id),
    defaultEnabled: meta.defaultEnabled,
    installed: true as const,
    ...(meta.featureFlag ? { featureFlag: meta.featureFlag } : {}),
    ...(meta.navViews?.length ? { navViews: meta.navViews } : {}),
  }))

  const atoms: ModuleCatalogItem[] = ALLOWLISTED_ATOM_META.map((meta) => ({
    id: meta.toggleId,
    kind: 'atom' as const,
    label: meta.label,
    description: meta.description,
    required: false,
    defaultEnabled: meta.defaultEnabled,
    installed: true as const,
  }))

  return [...products, ...particles, ...atoms].sort((a, b) => {
    const kindDelta = MODULE_KIND_ORDER[a.kind] - MODULE_KIND_ORDER[b.kind]
    if (kindDelta !== 0) return kindDelta
    return a.label.localeCompare(b.label)
  })
}

/** Resolve a catalog/product module id against site settings (defaults from catalog). */
export function isCatalogModuleEnabled(
  settings: SiteSettingsData,
  catalogId: string,
): boolean {
  const id = catalogId.trim()
  if (!id) return false
  if (REQUIRED_MODULE_IDS.has(id)) return true
  // Not in this install/build → treat as off (no deadweight toggle surface).
  if (!isModuleAllowlisted(id)) return false

  const item = listInstalledModuleCatalog().find((m) => m.id === id)
  if (item?.featureFlag) {
    const stored = settings.moduleToggles?.[id]
    if (typeof stored === 'boolean') return stored
    return Boolean(settings.features[item.featureFlag])
  }

  return isModuleToggleEnabled(settings, id, {
    defaultEnabled: item?.defaultEnabled !== false,
    legacyModulesFlag: id === 'notice-bar',
  })
}

/**
 * Persist catalog defaults for newly allowlisted packs.
 * Missing row + defaultEnabled/required → write `true` so upgrades (e.g.
 * product:email-manager) match Forms/Media without a SQL edit.
 * Explicit `false` is preserved after the one-shot repair below.
 */
export function mergeMissingCatalogModuleDefaults(
  toggles: ModuleToggleMap,
): { toggles: ModuleToggleMap; changed: boolean } {
  const next: ModuleToggleMap = { ...toggles }
  let changed = false
  for (const item of listInstalledModuleCatalog()) {
    if (typeof next[item.id] === 'boolean') continue
    if (item.required || item.defaultEnabled !== false) {
      next[item.id] = true
      changed = true
    }
  }
  return { toggles: changed ? next : toggles, changed }
}

/**
 * Marker written after repairing Modules empty-ids wipes that stored
 * `enabled:false` for every catalog row (including Email Manager).
 * After this runs once, explicit Modules off stays off.
 */
export const CATALOG_DEFAULTS_REPAIR_MARKER = '__sf_catalog_defaults_v1'

/**
 * One-shot: force defaultEnabled/required platform+product packs back on.
 * Fixes sites where a Modules submit without `moduleToggleId` fields wiped
 * every pack to false — Email never appeared even with codegen + nav wiring.
 */
export function repairCatalogModuleDefaultsOnce(
  toggles: ModuleToggleMap,
): { toggles: ModuleToggleMap; changed: boolean } {
  if (toggles[CATALOG_DEFAULTS_REPAIR_MARKER] === true) {
    return { toggles, changed: false }
  }

  const next: ModuleToggleMap = { ...toggles }
  let changed = false
  for (const item of listInstalledModuleCatalog()) {
    if (item.kind !== 'platform' && item.kind !== 'product') continue
    if (!(item.required || item.defaultEnabled !== false)) continue
    if (next[item.id] !== true) {
      next[item.id] = true
      changed = true
    }
  }
  next[CATALOG_DEFAULTS_REPAIR_MARKER] = true
  return { toggles: next, changed: true }
}

/** Sync FeatureFlags from product module toggles (and legacy extension master). */
export function featureFlagsFromModuleToggles(
  moduleToggles: Record<string, boolean>,
  catalog: ModuleCatalogItem[],
): FeatureFlags {
  const byFlag = (flag: keyof FeatureFlags, fallback: boolean): boolean => {
    const item = catalog.find((c) => c.featureFlag === flag)
    if (!item) return fallback
    if (typeof moduleToggles[item.id] === 'boolean') return moduleToggles[item.id]!
    return item.defaultEnabled
  }

  const anyExtensionOn = catalog.some(
    (item) => item.kind === 'particle' && !item.required && moduleToggles[item.id] === true,
  )

  return {
    registration: byFlag('registration', true),
    richEditor: byFlag('richEditor', true),
    posts: byFlag('posts', false),
    modules: anyExtensionOn,
    draftPreview: byFlag('draftPreview', false),
  }
}
