/**
 * Normalize a visitor path or redirect "from" for exact middleware match.
 * - Ensures leading `/`
 * - Strips query/hash
 * - Collapses duplicate slashes
 * - Drops trailing slash except for `/`
 */
export function normalizeRedirectFromPath(raw: string): string {
  let path = (raw || '').trim()
  if (!path) return ''

  // Absolute URLs → pathname only for "from" matching.
  if (/^https?:\/\//i.test(path)) {
    try {
      path = new URL(path).pathname
    } catch {
      return ''
    }
  }

  const q = path.indexOf('?')
  if (q >= 0) path = path.slice(0, q)
  const h = path.indexOf('#')
  if (h >= 0) path = path.slice(0, h)

  if (!path.startsWith('/')) path = `/${path}`
  path = path.replace(/\/{2,}/g, '/')

  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1)
  }

  // Reject empty / control chars / backslashes.
  if (!path || path.includes('\\') || /[\u0000-\u001f]/.test(path)) return ''

  return path
}

/**
 * Normalize redirect destination.
 * Relative paths get the same slash rules as from; absolute http(s) URLs pass through.
 */
export function normalizeRedirectToPath(raw: string): string {
  const trimmed = (raw || '').trim()
  if (!trimmed) return ''

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
      return url.toString()
    } catch {
      return ''
    }
  }

  // Protocol-relative or dangerous schemes rejected.
  if (trimmed.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return ''
  }

  return normalizeRedirectFromPath(trimmed)
}

/** Build NextResponse.redirect target from stored to + request origin. */
export function resolveRedirectDestination(to: string, requestOrigin: string): string {
  if (/^https?:\/\//i.test(to)) return to
  const origin = requestOrigin.replace(/\/$/, '')
  const path = to.startsWith('/') ? to : `/${to}`
  return `${origin}${path}`
}
