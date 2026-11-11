import DOMPurify from 'isomorphic-dompurify'

/** Tags allowed in Starforge rich HTML (TipTap + future data-sf blocks). */
const ALLOWED_TAGS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'a',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'hr',
  'img',
  'figure',
  'figcaption',
  'div',
  'span',
]

const ALLOWED_ATTR = [
  'href',
  'target',
  'rel',
  'src',
  'alt',
  'title',
  'class',
  'style',
  'data-media-id',
  'data-media-ids',
  'data-sf',
  'data-provider',
  'data-id',
  'data-src',
  'controls',
  'playsinline',
  'preload',
]

/** Transactional email HTML — no web chrome / embeds / classes. */
const EMAIL_ALLOWED_TAGS = [
  'h2',
  'h3',
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'a',
  'ul',
  'ol',
  'li',
  'img',
]

const EMAIL_ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'width', 'height', 'style']

export type SanitizeEmailHtmlOptions = {
  /** Site origin (no trailing slash). Relative href/src become absolute when set. */
  baseUrl?: string
}

/**
 * Sanitize editorial HTML before persist or public render.
 * Empty / whitespace-only input → empty string.
 */
export function sanitizeRichHtml(raw: string | null | undefined): string {
  if (raw == null) return ''
  const trimmed = String(raw).trim()
  if (!trimmed) return ''

  return DOMPurify.sanitize(trimmed, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover'],
  }).trim()
}

function normalizeBaseUrl(baseUrl: string | undefined): string {
  return (baseUrl || '').trim().replace(/\/$/, '')
}

/** Keep merge tokens; allow http(s), mailto, relative, hash. Strip javascript:/data:. */
function isSafeEmailUrl(raw: string): boolean {
  const t = raw.trim()
  if (!t) return false
  if (/\{\{[^}]+\}\}/.test(t)) return true
  if (/^(javascript|data|vbscript):/i.test(t)) return false
  if (/^https?:\/\//i.test(t)) return true
  if (/^mailto:/i.test(t)) return true
  if (t.startsWith('/') || t.startsWith('#') || t.startsWith('./') || t.startsWith('../')) {
    return true
  }
  return false
}

function absolutizeEmailUrl(raw: string, baseUrl: string): string {
  const t = raw.trim()
  if (!t) return ''
  if (/\{\{[^}]+\}\}/.test(t)) return t
  if (/^(https?:|mailto:)/i.test(t) || t.startsWith('#')) return t
  if (!baseUrl) return t
  if (t.startsWith('//')) {
    try {
      const proto = new URL(baseUrl).protocol || 'https:'
      return `${proto}${t}`
    } catch {
      return `https:${t}`
    }
  }
  if (t.startsWith('/')) return `${baseUrl}${t}`
  return `${baseUrl}/${t.replace(/^\.\//, '')}`
}

/** Keep only `text-align: left|center|right|justify` from inline style. */
function narrowEmailStyle(style: string): string {
  const m = /text-align\s*:\s*(left|center|right|justify)\b/i.exec(style || '')
  if (!m) return ''
  return `text-align: ${m[1].toLowerCase()}`
}

function rewriteEmailAttrs(html: string, baseUrl: string): string {
  return html.replace(/\s(href|src|style)="([^"]*)"/gi, (full, attr: string, value: string) => {
    const name = attr.toLowerCase()
    if (name === 'style') {
      const narrowed = narrowEmailStyle(value)
      return narrowed ? ` style="${narrowed}"` : ''
    }
    if (!isSafeEmailUrl(value)) return ''
    const next = absolutizeEmailUrl(value, baseUrl)
    return ` ${name}="${next}"`
  })
}

/**
 * Sanitize HTML for transactional email bodies (TipTap `preset="email"`).
 * Strips web-only nodes; optional absolute URL rewrite for img/a.
 */
export function sanitizeEmailHtml(
  raw: string | null | undefined,
  options?: SanitizeEmailHtmlOptions,
): string {
  if (raw == null) return ''
  const trimmed = String(raw).trim()
  if (!trimmed) return ''

  const cleaned = DOMPurify.sanitize(trimmed, {
    ALLOWED_TAGS: EMAIL_ALLOWED_TAGS,
    ALLOWED_ATTR: EMAIL_ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: [
      'script',
      'iframe',
      'object',
      'embed',
      'form',
      'input',
      'button',
      'div',
      'span',
      'figure',
      'figcaption',
      'video',
      'source',
    ],
    FORBID_ATTR: [
      'onerror',
      'onclick',
      'onload',
      'onmouseover',
      'class',
      'target',
      'rel',
      'data-sf',
      'data-media-id',
      'data-media-ids',
      'data-provider',
      'data-id',
      'data-src',
    ],
  }).trim()

  if (!cleaned) return ''
  return rewriteEmailAttrs(cleaned, normalizeBaseUrl(options?.baseUrl)).trim()
}
