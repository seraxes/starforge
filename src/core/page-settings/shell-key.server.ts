import 'server-only'

import { getPublicLayoutBundle } from '@/core/modules/layout'
import { resolveExistingLayoutId } from '@/core/modules/layout-store'
import { getActiveSkin } from '@/core/skin/resolve-active'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { emptyResolvedChrome } from './defaults'
import { getResolvedPageChrome, pageKeyFromPathname } from './resolve'
import type { PublicShellKey } from './shell-key'
import type { SectionsLayoutMode } from './types'

export async function paintedPublicShellKey(input: {
  layoutId: string
  sectionsLayout: SectionsLayoutMode
  /** Skin base outline when chrome has no layout id. */
  outlineFallbackId: string
  layoutManagerEnabled: boolean
}): Promise<PublicShellKey> {
  const requested = input.layoutId.trim()
  const rawOutline = requested || input.outlineFallbackId.trim() || 'default'
  const outlineId = (await resolveExistingLayoutId(rawOutline)) || rawOutline
  if (!input.layoutManagerEnabled) {
    return {
      layoutId: 'minimal',
      outlineId,
      sectionsLayout: input.sectionsLayout,
    }
  }
  // Match PublicLayoutBody: empty chrome layoutId falls through to the default outline.
  const bundle = await getPublicLayoutBundle(requested || undefined)
  return {
    layoutId: bundle.layoutId,
    outlineId,
    sectionsLayout: input.sectionsLayout,
  }
}

/** Shell identity for a public pathname (locale prefix allowed). */
export async function resolvePublicShellKeyFromPath(pathname: string): Promise<PublicShellKey> {
  const pageKey = pageKeyFromPathname(pathname)
  const [settings, skin] = await Promise.all([getSiteSettings(), getActiveSkin()])
  const pageSettingsOn = isCatalogModuleEnabled(settings, MODULE_IDS.pageSettings)
  const layoutOn = isCatalogModuleEnabled(settings, MODULE_IDS.layoutManager)
  const chrome = pageSettingsOn
    ? await getResolvedPageChrome(pageKey)
    : emptyResolvedChrome(pageKey)
  const outlineFallback = skin.preferredDefaultOutlineId || skin.id
  return paintedPublicShellKey({
    layoutId: chrome.layoutId,
    sectionsLayout: chrome.sectionsLayout,
    outlineFallbackId: outlineFallback,
    layoutManagerEnabled: layoutOn,
  })
}
