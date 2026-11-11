/**
 * Load + merge Core catalogs with allowlisted / enabled module namespaces (i18n P3).
 * Core must not import `@/modules/**` — loaders come from `@/generated/module-registry.server`.
 */
import 'server-only'

import { moduleMessageLoaders } from '@/generated/module-registry.server'
import { getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

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
 * Core chrome (`Auth`, `Layout`, `Locale`, …) plus each enabled module’s namespaces.
 * Disabled (Site Settings off) or non-allowlisted packs are omitted.
 */
export async function loadMergedMessages(locale: string): Promise<MessageTree> {
  const core = await loadCoreCatalog(locale)

  let settings: Awaited<ReturnType<typeof getSiteSettings>> | null = null
  try {
    settings = await getSiteSettings()
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
