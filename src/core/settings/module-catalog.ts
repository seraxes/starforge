import { ensureAtomsRegistered, listRegisteredAtoms } from '@/core/page-settings/atoms'
import { listRegisteredModules } from '@/core/modules/registry'
import { ensureModulesRegistered } from '@/modules/catalog'

import type { FeatureFlags, SiteSettingsData } from './defaults'
import {
  MODULE_IDS,
  MODULE_KIND_ORDER,
  REQUIRED_MODULE_IDS,
  atomToggleId,
  isModuleToggleEnabled,
  type ModuleCatalogItem,
} from './module-toggles'

/**
 * Platform + product capabilities always present in this Starforge build (P0).
 * Particles/atoms append from registries.
 */
export const PRODUCT_MODULE_CATALOG: ModuleCatalogItem[] = [
  {
    id: MODULE_IDS.betterAuth,
    kind: 'platform',
    label: 'Better Auth',
    description: 'Core app login, sessions, and users. Required — sole sign-in for Starforge.',
    required: true,
    defaultEnabled: true,
    installed: true,
  },
  {
    id: MODULE_IDS.payloadCms,
    kind: 'platform',
    label: 'Payload CMS',
    description: 'Content CMS (/admin) for pages and media. Off hides CMS nav and blocks Payload admin entry when safe.',
    required: false,
    defaultEnabled: true,
    installed: true,
  },
  {
    id: MODULE_IDS.layoutManager,
    kind: 'product',
    label: 'Layout manager / Outlines',
    description: 'Gantry-like layout canvas and named outlines. Off hides Layout/Outlines admin and uses a minimal public shell.',
    required: false,
    defaultEnabled: true,
    installed: true,
  },
  {
    id: MODULE_IDS.pageSettings,
    kind: 'product',
    label: 'Page Settings',
    description: 'Document chrome (Head, Assets, Body, FA, Atoms) and layout assignment. Off hides Page settings admin and skips public chrome emit.',
    required: false,
    defaultEnabled: true,
    installed: true,
  },
  {
    id: MODULE_IDS.primaryNav,
    kind: 'product',
    label: 'Primary nav',
    description:
      'Nav manager + public header menu. Off hides Core admin → Nav and public header links. Site Settings picks which menu set is the site default.',
    required: false,
    defaultEnabled: true,
    installed: true,
  },
  {
    id: MODULE_IDS.fontAwesome,
    kind: 'product',
    label: 'Font Awesome',
    description: 'Optional Font Awesome CDN from Page Settings. Off skips FA assets on the public site.',
    required: false,
    defaultEnabled: true,
    installed: true,
  },
  {
    id: MODULE_IDS.registration,
    kind: 'product',
    label: 'Registration',
    description: 'Allow /register for new app accounts.',
    required: false,
    defaultEnabled: true,
    installed: true,
    featureFlag: 'registration',
  },
  {
    id: MODULE_IDS.richEditor,
    kind: 'product',
    label: 'Rich editor',
    description: 'Lexical rich editing flag (Pages stay Lexical for now; off reserved for a simpler mode).',
    required: false,
    defaultEnabled: true,
    installed: true,
    featureFlag: 'richEditor',
  },
  {
    id: MODULE_IDS.posts,
    kind: 'product',
    label: 'Posts',
    description: 'Posts collection placeholder — keep off until that slice ships.',
    required: false,
    defaultEnabled: false,
    installed: true,
    featureFlag: 'posts',
  },
  {
    id: MODULE_IDS.draftPreview,
    kind: 'product',
    label: 'Draft preview',
    description: 'CMS-access users can open /preview/{slug} for unpublished drafts.',
    required: false,
    defaultEnabled: false,
    installed: true,
    featureFlag: 'draftPreview',
  },
]

/**
 * Installed catalog for Site Settings → Modules (P0).
 * Platform + product capabilities + registered particles + atoms.
 */
export function listInstalledModuleCatalog(): ModuleCatalogItem[] {
  ensureModulesRegistered()
  ensureAtomsRegistered()

  const particles: ModuleCatalogItem[] = listRegisteredModules().map((mod) => {
    const required = REQUIRED_MODULE_IDS.has(mod.id)
    const legacyOffByDefault = mod.featureFlag === 'modules'
    return {
      id: mod.id,
      kind: 'particle' as const,
      label: mod.name,
      description:
        mod.description?.trim() ||
        (mod.builtin ? 'Built-in layout particle' : 'Extension module'),
      required,
      defaultEnabled: required || !legacyOffByDefault,
      installed: true as const,
    }
  })

  const atoms: ModuleCatalogItem[] = listRegisteredAtoms().map((atom) => ({
    id: atomToggleId(atom.type),
    kind: 'atom' as const,
    label: atom.label,
    description: atom.description?.trim() || `Page Settings atom (${atom.type})`,
    required: false,
    defaultEnabled: true,
    installed: true as const,
  }))

  return [...PRODUCT_MODULE_CATALOG, ...particles, ...atoms].sort((a, b) => {
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
