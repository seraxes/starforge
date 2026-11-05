/**
 * Modules catalog → info/settings pages (SF-230).
 *
 * Preference: every installed module gets an info/settings surface.
 * Reuse an existing Settings menu when present; otherwise use the Core host
 * at `/admin/settings/modules/<id>`. Soft stubs OK when a pack has no knobs.
 */

import { adminNavContributions } from '@/generated/module-registry'

import { listInstalledModuleCatalog } from './module-catalog'
import type { ModuleCatalogItem } from './module-toggles'

/** Path-safe module id (`product:media` → `product~media`). */
export function moduleIdPathSegment(moduleId: string): string {
  return moduleId.trim().replaceAll(':', '~')
}

/** Inverse of {@link moduleIdPathSegment} (also tolerates encodeURIComponent). */
export function moduleIdFromPathSegment(segment: string): string {
  const raw = decodeURIComponent(segment.trim())
  return raw.replaceAll('~', ':')
}

/** Canonical Core info/settings host for a catalog module id. */
export function moduleInfoSettingsHref(moduleId: string): string {
  const id = moduleId.trim()
  if (!id) return '/admin/settings'
  return `/admin/settings/modules/${moduleIdPathSegment(id)}`
}

/**
 * Prefer an existing Settings leaf (admin.nav label or navViews key).
 * Falls back to the Core host page.
 */
export function resolveModuleInfoSettingsHref(
  moduleId: string,
  catalogItem?: ModuleCatalogItem | null,
): string {
  const id = moduleId.trim()
  if (!id) return '/admin/settings'

  const existing = findExistingModuleSettingsHref(id, catalogItem)
  return existing ?? moduleInfoSettingsHref(id)
}

/** Existing Settings menu href when the pack already ships one. */
export function findExistingModuleSettingsHref(
  moduleId: string,
  catalogItem?: ModuleCatalogItem | null,
): string | null {
  const id = moduleId.trim()
  if (!id) return null

  const contrib = adminNavContributions.find((row) => row.moduleId === id)
  const settingsNav = contrib?.links.find((link) =>
    /^settings$/i.test(link.label.trim()),
  )
  if (settingsNav?.href?.trim()) return settingsNav.href.trim()

  const item =
    catalogItem ?? listInstalledModuleCatalog().find((row) => row.id === id) ?? null
  const settingsView = item?.navViews?.find((view) => view.key === 'settings')
  if (settingsView?.href?.trim()) return settingsView.href.trim()

  return null
}

/** Whether the resolved href is the Core host (vs a pack-owned Settings page). */
export function isCoreModuleInfoSettingsHref(href: string, moduleId: string): boolean {
  return href.trim() === moduleInfoSettingsHref(moduleId)
}
