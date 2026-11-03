import type { RedirectStatusCode } from './types'

/** Paths middleware / CRUD must never claim as redirect sources. */
const BLOCKED_FROM_PREFIXES = ['/api', '/admin', '/app', '/_next'] as const

const BLOCKED_FROM_EXACT = new Set([
  '/robots.txt',
  '/sitemap.xml',
  '/favicon.ico',
  '/site-offline',
  '/login',
  '/register',
  '/forgot-password',
  '/forgot-username',
  '/reset-password',
  '/two-factor',
  '/sign-out',
])

/**
 * Normalize a from-path: trim, ensure leading `/`, drop query/hash, collapse
 * trailing slash (except `/`). Returns null when empty or blocked.
 */
export function normalizeFromPath(raw: string): string | null {
  let value = (raw || '').trim()
  if (!value) return null

  // Absolute URL → pathname only
  if (/^https?:\/\//i.test(value)) {
    try {
      const u = new URL(value)
      value = u.pathname || '/'
    } catch {
      return null
    }
  }

  const q = value.indexOf('?')
  if (q >= 0) value = value.slice(0, q)
  const h = value.indexOf('#')
  if (h >= 0) value = value.slice(0, h)

  value = value.trim()
  if (!value) return null
  if (!value.startsWith('/')) value = `/${value}`

  // Collapse duplicate slashes
  value = value.replace(/\/{2,}/g, '/')

  if (value.length > 1 && value.endsWith('/')) {
    value = value.slice(0, -1)
  }

  if (value.length > 512) return null
  if (isBlockedFromPath(value)) return null
  return value
}

export function isBlockedFromPath(pathname: string): boolean {
  const path = pathname.trim() || '/'
  if (BLOCKED_FROM_EXACT.has(path)) return true
  for (const prefix of BLOCKED_FROM_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return true
  }
  return false
}

/**
 * Normalize redirect target: absolute http(s) URL or site-relative path
 * (leading `/`). Empty → null.
 */
export function normalizeToUrl(raw: string): string | null {
  const value = (raw || '').trim()
  if (!value) return null
  if (value.length > 2048) return null

  if (/^https?:\/\//i.test(value)) {
    try {
      const u = new URL(value)
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
      return u.toString()
    } catch {
      return null
    }
  }

  // Relative path
  let path = value
  if (!path.startsWith('/')) path = `/${path}`
  if (path.startsWith('//')) return null // protocol-relative — reject
  return path
}

export function normalizeStatusCode(raw: unknown): RedirectStatusCode {
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10)
  return n === 302 ? 302 : 301
}

/** Paths that skip redirect middleware lookup (ops + SEO endpoints). */
export function isRedirectExemptPath(pathname: string): boolean {
  if (isBlockedFromPath(pathname)) return true
  if (pathname === '/sitemap.xml' || pathname.startsWith('/sitemap')) return true
  return false
}
