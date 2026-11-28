/**
 * Load + merge Core catalogs with allowlisted / enabled module namespaces (i18n P3).
 * Core must not import `@/modules/**` — loaders come from `@/generated/module-registry.server`.
 */
import 'server-only'

import { moduleMessageLoaders } from '@/generated/module-registry.server'
import { DEFAULT_SITE_SETTINGS, type SiteSettingsData } from '@/core/settings/defaults'
import { isCatalogModuleEnabled } from '@/core/settings/module-catalog'
import { normalizeModuleToggles } from '@/core/settings/module-toggles'
import { readSiteSettingsRow, type SiteSettingsRow } from '@/core/settings/store'

import { BOOTSTRAP_LOCALES, DEFAULT_LOCALE } from './locales'
import { mergeMessageTrees, wrapModuleMessages, type MessageTree } from './merge-messages'

/**
 * Only bootstrap packs ship under `./messages/`. Admin-added codes must not
 * hit `import(\`./messages/${locale}.json\`)` — Turbopack/webpack can hang the
 * whole process resolving a missing file until the server is restarted.
 */
function coreMessageLocale(locale: string): string {
  return (BOOTSTRAP_LOCALES as readonly string[]).includes(locale)
    ? locale
    : DEFAULT_LOCALE
}

async function loadCoreCatalog(locale: string): Promise<MessageTree> {
  const code = coreMessageLocale(locale)
  return (await import(`./messages/${code}.json`)).default as MessageTree
}

async function loadModuleLeaf(
  load: (locale: string) => Promise<Record<string, unknown>>,
  locale: string,
): Promise<MessageTree> {
  // Same bootstrap-only rule as Core catalogs — avoid probing missing packs.
  const code = coreMessageLocale(locale)
  try {
    return (await load(code)) as MessageTree
  } catch {
    if (code === DEFAULT_LOCALE) return {}
    try {
      return (await load(DEFAULT_LOCALE)) as MessageTree
    } catch {
      return {}
    }
  }
}

/**
 * Toggle snapshot that does not call `getSiteSettings`.
 *
 * `getRequestConfig` awaits this loader. `getSiteSettings` resolves nav, and
 * nav calls `getLocale()`, which waits on the same in-flight request config.
 * That cycle never settles, so the first public SSR (`/en`) hangs.
 */
function settingsForModuleGates(row: SiteSettingsRow | null): SiteSettingsData {
  const moduleToggles = normalizeModuleToggles(row?.moduleToggles)
  const features = { ...DEFAULT_SITE_SETTINGS.features }
  if (row) {
    features.registration = row.featureRegistration
    features.richEditor = row.featureRichEditor
    features.posts = row.featurePosts
    features.modules = row.featureModules
    features.draftPreview = row.featureDraftPreview
  }
  return { ...DEFAULT_SITE_SETTINGS, moduleToggles, features }
}

/**
 * Core chrome (`Auth`, `Layout`, `Locale`, …) plus each enabled module’s namespaces.
 * Disabled (Site Settings off) or non-allowlisted packs are omitted.
 */
export async function loadMergedMessages(locale: string): Promise<MessageTree> {
  const core = await loadCoreCatalog(locale)

  let settings: SiteSettingsData | null = null
  try {
    settings = settingsForModuleGates(await readSiteSettingsRow())
  } catch {
    // Early boot / migrate — keep allowlisted packs when settings are unreachable.
    settings = null
  }

  const enabledLoaders = moduleMessageLoaders.filter((loader) => {
    if (!settings) return true
    return isCatalogModuleEnabled(settings, loader.moduleId)
  })

  const moduleTrees = await Promise.all(
    enabledLoaders.map(async (loader) => {
      const leaf = await loadModuleLeaf(loader.load, locale)
      return wrapModuleMessages(loader.namespaces, leaf)
    }),
  )

  return mergeMessageTrees(core, ...moduleTrees)
}
