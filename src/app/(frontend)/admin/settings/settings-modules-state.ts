/**
 * Pure helpers for Settings → Modules checkbox remount / resolve.
 * Kept out of the client form so node:test can cover the sync key.
 */

import type { FeatureFlags, ModuleToggleMap } from '@/core/settings/defaults'
import type { ModuleCatalogItem } from '@/core/settings/module-toggles'

export function resolveModuleToggleChecked(
  item: ModuleCatalogItem,
  toggles: ModuleToggleMap,
  features: FeatureFlags,
): boolean {
  if (item.required) return true
  if (typeof toggles[item.id] === 'boolean') return toggles[item.id]!
  if (item.featureFlag) return Boolean(features[item.featureFlag])
  if (!item.defaultEnabled) return features.modules
  return true
}

/** Stable signature so uncontrolled checkboxes remount when effective toggles change. */
export function moduleTogglesSignature(toggles: ModuleToggleMap): string {
  return Object.keys(toggles)
    .sort()
    .map((id) => `${id}:${toggles[id] ? 1 : 0}`)
    .join(',')
}

/**
 * After a successful Modules save, prefer action-returned toggles (includes
 * requires-graph auto-enables). Returns null when the action did not carry them.
 */
export function applyModulesActionToggles(
  action: { ok?: boolean; moduleToggles?: ModuleToggleMap; features?: FeatureFlags },
  current: { moduleToggles: ModuleToggleMap; features: FeatureFlags },
): { moduleToggles: ModuleToggleMap; features: FeatureFlags } | null {
  if (!action.ok || !action.moduleToggles) return null
  return {
    moduleToggles: action.moduleToggles,
    features: action.features ?? current.features,
  }
}
