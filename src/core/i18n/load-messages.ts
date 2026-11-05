/**
 * Load + merge Core catalogs with allowlisted / enabled module namespaces (i18n P3).
 * Core must not import `@/modules/**` — loaders come from `@/generated/module-registry.server`.
 */
import 'server-only'

import { moduleMessageLoaders } from '@/generated/module-registry.server'
import { getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { DEFAULT_LOCALE } from './locales'
import { mergeMessageTrees, wrapModuleMessages, type MessageTree } from './merge-messages'

async function loadCoreCatalog(locale: string): Promise<MessageTree> {
  try {
    return (await import(`./messages/${locale}.json`)).default as MessageTree
  } catch {
    return (await import(`./messages/${DEFAULT_LOCALE}.json`)).default as MessageTree
  }
}

async function loadModuleLeaf(
  load: (locale: string) => Promise<Record<string, unknown>>,
  locale: string,
): Promise<MessageTree> {
  try {
    return (await load(locale)) as MessageTree
  } catch {
    if (locale === DEFAULT_LOCALE) return {}
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
