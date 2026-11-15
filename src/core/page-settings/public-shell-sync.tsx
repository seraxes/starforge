'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useLayoutEffect, useRef } from 'react'

import { resolvePublicShellKeyAction } from './shell-key-action'
import {
  normalizePublicPath,
  publicShellKeyMatches,
  type PublicShellKey,
} from './shell-key'

const STALE_ATTR = 'data-sf-shell-stale'
const HARD_NAV_KEY = 'sf-shell-hard-nav'

const shellKeyCache = new Map<string, PublicShellKey>()
const shellKeyInflight = new Map<string, Promise<PublicShellKey | null>>()

/** Latest shell the server painted. Click handlers read this; updated only in the browser. */
const painted: { path: string; key: PublicShellKey } = {
  path: '',
  key: { layoutId: '', outlineId: '', sectionsLayout: 'fullwidth' },
}

function rememberShellKey(path: string, key: PublicShellKey) {
  shellKeyCache.set(normalizePublicPath(path), key)
}

function prefetchShellKey(path: string): Promise<PublicShellKey | null> {
  const normalized = normalizePublicPath(path)
  const cached = shellKeyCache.get(normalized)
  if (cached) return Promise.resolve(cached)
  const pending = shellKeyInflight.get(normalized)
  if (pending) return pending
  const job = resolvePublicShellKeyAction(normalized)
    .then((key) => {
      if (key) shellKeyCache.set(normalized, key)
      return key
    })
    .catch(() => null)
    .finally(() => {
      shellKeyInflight.delete(normalized)
    })
  shellKeyInflight.set(normalized, job)
  return job
}

function pathFromAnchor(anchor: HTMLAnchorElement): string | null {
  if (anchor.target && anchor.target !== '_self') return null
  if (anchor.hasAttribute('download')) return null
  const raw = anchor.getAttribute('href')
  if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:')) {
    return null
  }
  let url: URL
  try {
    url = new URL(anchor.href, window.location.href)
  } catch {
    return null
  }
  if (url.origin !== window.location.origin) return null
  return normalizePublicPath(url.pathname)
}

function markShellStale() {
  document.documentElement.setAttribute(STALE_ATTR, '1')
}

function clearShellStale() {
  document.documentElement.removeAttribute(STALE_ATTR)
}

function hardNavBlockedFor(pathname: string): boolean {
  try {
    return sessionStorage.getItem(HARD_NAV_KEY) === pathname
  } catch {
    return false
  }
}

function rememberHardNav(pathname: string) {
  try {
    sessionStorage.setItem(HARD_NAV_KEY, pathname)
  } catch {
    // Private mode can reject storage; the refresh path still runs.
  }
}

function forgetHardNav() {
  try {
    sessionStorage.removeItem(HARD_NAV_KEY)
  } catch {
    // ignore
  }
}

type Props = {
  /** Full pathname this shell was rendered for (locale included, as `usePathname`). */
  renderedPath: string
  shellKey: PublicShellKey
}

/**
 * Next.js reuses the `[locale]` segment on client navigations, including this
 * template, so the previous outline stays painted. When the destination outline
 * or sections width differs, load that URL as a document so the shell renders
 * with the request path. Same-outline pages keep the instant navigation.
 */
export function PublicShellSync({ renderedPath, shellKey }: Props) {
  const pathname = normalizePublicPath(usePathname() || '/')
  const normalizedRendered = normalizePublicPath(renderedPath)
  const pathChanged = pathname !== normalizedRendered
  const gen = useRef(0)
  const layoutId = shellKey.layoutId
  const outlineId = shellKey.outlineId
  const sectionsLayout = shellKey.sectionsLayout

  useLayoutEffect(() => {
    painted.path = normalizedRendered
    painted.key = { layoutId, outlineId, sectionsLayout }
    rememberShellKey(normalizedRendered, painted.key)
  }, [normalizedRendered, layoutId, outlineId, sectionsLayout])

  useEffect(() => {
    const warm = (event: Event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest('a')
      if (!(anchor instanceof HTMLAnchorElement)) return
      const path = pathFromAnchor(anchor)
      if (!path || path === painted.path) return
      void prefetchShellKey(path)
    }
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest('a')
      if (!(anchor instanceof HTMLAnchorElement)) return
      const path = pathFromAnchor(anchor)
      if (!path || path === painted.path) return
      const cached = shellKeyCache.get(path)
      if (!cached || publicShellKeyMatches(cached, painted.key)) return
      event.preventDefault()
      event.stopPropagation()
      window.location.assign(anchor.href)
    }
    const warmVisibleLinks = () => {
      const anchors = document.querySelectorAll('a[href]')
      let scheduled = 0
      anchors.forEach((node) => {
        if (scheduled >= 12) return
        if (!(node instanceof HTMLAnchorElement)) return
        const path = pathFromAnchor(node)
        if (!path || path === painted.path || shellKeyCache.has(path)) return
        scheduled += 1
        void prefetchShellKey(path)
      })
    }
    document.addEventListener('pointerover', warm, true)
    document.addEventListener('pointerdown', warm, true)
    document.addEventListener('focusin', warm, true)
    document.addEventListener('click', onClick, true)
    const idle =
      typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback(() => warmVisibleLinks())
        : 0
    const timer = idle ? 0 : window.setTimeout(warmVisibleLinks, 400)
    return () => {
      document.removeEventListener('pointerover', warm, true)
      document.removeEventListener('pointerdown', warm, true)
      document.removeEventListener('focusin', warm, true)
      document.removeEventListener('click', onClick, true)
      if (idle) window.cancelIdleCallback(idle)
      if (timer) window.clearTimeout(timer)
    }
  }, [])

  useLayoutEffect(() => {
    const my = ++gen.current
    if (!pathChanged) {
      forgetHardNav()
      clearShellStale()
      return
    }

    const renderedKey: PublicShellKey = { layoutId, outlineId, sectionsLayout }

    const reloadIfDifferent = (key: PublicShellKey | null) => {
      if (gen.current !== my) return
      if (!key || publicShellKeyMatches(key, renderedKey)) {
        clearShellStale()
        return
      }
      if (hardNavBlockedFor(pathname)) {
        clearShellStale()
        return
      }
      // Hide the reused outline before paint, then load the document for this URL.
      markShellStale()
      rememberHardNav(pathname)
      window.location.assign(window.location.href)
    }

    const cached = shellKeyCache.get(pathname)
    if (cached) {
      reloadIfDifferent(cached)
      return
    }

    // Unknown shell: keep the reused outline off-screen until we know it still applies.
    markShellStale()
    void prefetchShellKey(pathname).then(reloadIfDifferent)
  }, [pathChanged, pathname, layoutId, outlineId, sectionsLayout])

  return null
}
