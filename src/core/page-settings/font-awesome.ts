import type { ResolvedPageChrome } from './types'

/** CDN snippets for Font Awesome Free (site panel). */
const FA_CDN: Record<
  string,
  { css: string; v4Shim?: string }
> = {
  '6-free': {
    css: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css',
    v4Shim: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/v4-shims.min.css',
  },
  '7-free': {
    css: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.0.0/css/all.min.css',
    v4Shim: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.0.0/css/v4-shims.min.css',
  },
}

export type FontAwesomeEmit = {
  /** Prefer these as React `<link>` hrefs when no HTML override. */
  linkHrefs: string[]
  /** Raw link/script HTML when admin set overrides. */
  cssLinkHtml: string
  jsScriptHtml: string
}

/**
 * Resolve Font Awesome assets for the public document shell.
 * Custom CSS/JS HTML overrides win when non-empty (developer-admin).
 */
export function resolveFontAwesomeEmit(chrome: ResolvedPageChrome): FontAwesomeEmit | null {
  const fa = chrome.fontAwesome
  if (!fa.enabled) return null

  const cssOverride = fa.cssLinkHtml?.trim() ?? ''
  const jsOverride = fa.jsScriptHtml?.trim() ?? ''
  if (cssOverride || jsOverride) {
    return {
      linkHrefs: [],
      cssLinkHtml: cssOverride,
      jsScriptHtml: jsOverride,
    }
  }

  const pack = FA_CDN[fa.version] ?? FA_CDN['6-free']
  const linkHrefs = [pack.css]
  if (fa.v4Compat && pack.v4Shim) {
    linkHrefs.push(pack.v4Shim)
  }

  return {
    linkHrefs,
    cssLinkHtml: '',
    jsScriptHtml: '',
  }
}
