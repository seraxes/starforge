import { builtinParticles } from '@/core/modules/particles'
import {
  ALLOWLISTED_ATOM_META,
  ALLOWLISTED_OPTIONAL_PARTICLE_META,
  ALLOWLISTED_PRODUCT_PLATFORM_IDS,
  isModuleAllowlisted,
} from '@/generated/module-registry'

import type { FeatureFlags, SiteSettingsData } from './defaults'
import {
  MODULE_IDS,
  MODULE_KIND_ORDER,
  REQUIRED_MODULE_IDS,
  isModuleToggleEnabled,
  type ModuleCatalogItem,
} from './module-toggles'

/**
 * Platform + product capabilities declared for Starforge core.
 * Site Settings only lists rows whose ids are in the install allowlist.
 */
export const PRODUCT_MODULE_CATALOG: ModuleCatalogItem[] = [
  {
    id: MODULE_IDS.betterAuth,
    kind: 'platform',
    label: 'Better Auth',
    description:
      'Core app login, sessions, password reset, passwordless, and TOTP 2FA. Required — sole sign-in for Starforge.',
    required: true,
    defaultEnabled: true,
    installed: true,
    navViews: [
      { key: 'login', label: 'Sign in', href: '/login' },
      { key: 'forgot-password', label: 'Forgot password', href: '/forgot-password' },
      { key: 'forgot-username', label: 'Forgot login email', href: '/forgot-username' },
      { key: 'account-security', label: 'Account security', href: '/account/security' },
    ],
  },
  {
    id: MODULE_IDS.payloadCms,
    kind: 'platform',
    label: 'Payload CMS',
    description: 'Content CMS (/admin) for pages and media. Off hides CMS nav and blocks Payload admin entry when safe.',
    required: false,
    defaultEnabled: true,
    installed: true,
    navViews: [{ key: 'admin', label: 'Content CMS', href: '/admin' }],
  },
  {
    id: MODULE_IDS.layoutManager,
    kind: 'product',
    label: 'Layout manager / Outlines',
    description: 'Gantry-like layout canvas and named outlines. Off hides Layout/Outlines admin and uses a minimal public shell.',
    required: false,
    defaultEnabled: true,
    installed: true,
    navViews: [
      { key: 'layout', label: 'Layout canvas', href: '/app/admin/layouts' },
      { key: 'outlines', label: 'Outlines', href: '/app/admin/outlines' },
    ],
  },
  {
    id: MODULE_IDS.pageSettings,
    kind: 'product',
    label: 'Page Settings',
    description: 'Document chrome (Head, Assets, Body, FA, Atoms) and layout assignment. Off hides Page settings admin and skips public chrome emit.',
    required: false,
    defaultEnabled: true,
    installed: true,
    navViews: [{ key: 'page-settings', label: 'Page settings', href: '/app/admin/page-settings' }],
  },
  {
    id: MODULE_IDS.primaryNav,
    kind: 'product',
    label: 'Primary nav',
    description:
      'Navigation manager + public header menu. Off hides Core admin → Navigation and public header links. Site Settings picks which menu set is the site default.',
    required: false,
    defaultEnabled: true,
    installed: true,
    navViews: [{ key: 'nav-manager', label: 'Navigation manager', href: '/app/admin/nav' }],
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
    navViews: [{ key: 'register', label: 'Register', href: '/register' }],
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
  {
    id: MODULE_IDS.forms,
    kind: 'product',
    label: 'Forms',
    description:
      'Modular Form engine — visual builder (JSON Schema/Zod), Form particle, presets (contact + stubs). Captcha from Site Chrome; Turnstile keys from env.',
    required: false,
    defaultEnabled: true,
    installed: true,
    navViews: [{ key: 'admin', label: 'Forms', href: '/app/admin/forms' }],
  },
]

const productPlatformAllow = new Set<string>(ALLOWLISTED_PRODUCT_PLATFORM_IDS)

/**
 * Installed catalog for Site Settings → Modules.
 * Only allowlisted (install/build) modules appear — runtime toggles apply on top.
 * Particle/atom rows use generated allowlist metadata so listing stays sync
 * without eager-importing optional packs.
 */
export function listInstalledModuleCatalog(): ModuleCatalogItem[] {
  const products = PRODUCT_MODULE_CATALOG.filter(
    (item) => item.required || productPlatformAllow.has(item.id) || isModuleAllowlisted(item.id),
  )

  const builtinParticlesRows: ModuleCatalogItem[] = builtinParticles
    .filter((mod) => isModuleAllowlisted(mod.id))
    .map((mod) => {
      const required = REQUIRED_MODULE_IDS.has(mod.id)
      return {
        id: mod.id,
        kind: 'particle' as const,
        label: mod.name,
        description:
          mod.description?.trim() ||
          (mod.builtin ? 'Built-in layout particle' : 'Extension module'),
        required,
        defaultEnabled: required || mod.featureFlag !== 'modules',
        installed: true as const,
        ...(mod.navViews?.length ? { navViews: mod.navViews } : {}),
      }
    })

  const optionalParticles: ModuleCatalogItem[] = ALLOWLISTED_OPTIONAL_PARTICLE_META.map((meta) => ({
    id: meta.id,
    kind: 'particle' as const,
    label: meta.name,
    description: meta.description,
    required: meta.required,
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

  return [...products, ...builtinParticlesRows, ...optionalParticles, ...atoms].sort((a, b) => {
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
