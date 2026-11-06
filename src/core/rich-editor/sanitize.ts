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
