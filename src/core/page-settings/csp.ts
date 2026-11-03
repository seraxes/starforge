import {
  cssOriginSources,
  htmlAssetSources,
  mergeCspSources,
  scriptOriginSources,
  type CspSources,
} from '@/core/security/csp'

import { resolveFontAwesomeEmit } from './font-awesome'
import type { AtomInjectResult, ResolvedPageChrome, StarforgeAtomDefinition } from './types'

export type PageChromeCspOptions = {
  /** `product:font-awesome` toggle (the public layout forces FA off when false). */
  fontAwesomeOn: boolean
  isAtomEnabled: (type: string) => boolean
  getAtom: (type: string) => StarforgeAtomDefinition | undefined
}

function injectSources(injects: AtomInjectResult[]): CspSources[] {
  const out: CspSources[] = []
  for (const inject of injects) {
    for (const href of inject.cssUrls ?? []) {
      const s = cssOriginSources(href)
      if (s) out.push(s)
    }
    for (const src of inject.scriptUrls ?? []) {
      const s = scriptOriginSources(src)
      if (s) out.push(s)
    }
    out.push(htmlAssetSources(inject.html))
  }
  return out
}

/**
 * External origins the public document shell will load for these resolved
 * chromes: CSS/JS lists, Font Awesome (CDN or HTML override), developer-admin
 * HTML hooks, and enabled atoms. Mirrors `DocumentHeadChrome` / `DocumentBodyChrome`.
 */
export function pageChromeCspSources(
  chromes: ResolvedPageChrome[],
  options: PageChromeCspOptions,
): CspSources {
  const groups: Array<CspSources | null> = []

  for (const chrome of chromes) {
    if (options.fontAwesomeOn) {
      const fa = resolveFontAwesomeEmit(chrome)
      if (fa) {
        for (const href of fa.linkHrefs) groups.push(cssOriginSources(href))
        groups.push(htmlAssetSources(fa.cssLinkHtml), htmlAssetSources(fa.jsScriptHtml))
      }
    }

    for (const asset of chrome.css) groups.push(cssOriginSources(asset.url))
    for (const asset of chrome.javascript) groups.push(scriptOriginSources(asset.url))

    groups.push(
      htmlAssetSources(chrome.customHeadHtml),
      htmlAssetSources(chrome.afterBodyHtml),
      htmlAssetSources(chrome.beforeBodyCloseHtml),
    )

    for (const atom of chrome.atoms) {
      if (!atom.enabled || !options.isAtomEnabled(atom.type)) continue
      const def = options.getAtom(atom.type)
      if (!def) continue
      const config = { ...(atom.config ?? {}) }
      try {
        groups.push(...injectSources(def.inject(config)))
        groups.push(def.csp?.(config) ?? null)
      } catch {
        // A broken atom config must not take the policy down with it.
      }
    }
  }

  return mergeCspSources(...groups)
}
